import type { PoolClient } from "pg";
import type { Db } from "./pool.js";
import { withTransaction } from "./transaction.js";
import type { Vote, VoteChoice } from "../../domain/vote.js";

export type CastResult =
  | { readonly ok: true; readonly vote: Vote }
  | { readonly ok: false; readonly reason: "not_found" | "closed" };

interface VoteRow {
  id: string;
  description: string;
  author_id: string;
  closed: boolean;
  created_at: number;
  /** `jsonb_object_agg` over a boolean column, so the values are booleans. */
  ballots: Record<string, boolean>;
}

/**
 * Reassembles the ballots into the map the domain model uses. Storing them as
 * rows and aggregating on read costs one subquery and buys a primary key that
 * makes double-voting impossible.
 */
const SELECT_VOTE = `
  SELECT v.id, v.description, v.author_id, v.closed, v.created_at,
         COALESCE(
           (SELECT jsonb_object_agg(b.user_id, b.choice)
            FROM vote_ballots b
            WHERE b.vote_id = v.id),
           '{}'::jsonb
         ) AS ballots
  FROM votes v
  WHERE v.id = $1
`;

function rowToVote(row: VoteRow): Vote {
  return {
    id: row.id,
    description: row.description,
    authorId: row.author_id,
    users: row.ballots,
    closed: row.closed,
    createdAt: row.created_at,
  };
}

async function readVote(
  client: PoolClient | Db,
  voteId: string,
): Promise<Vote | null> {
  const { rows } = await client.query<VoteRow>(SELECT_VOTE, [voteId]);
  const row = rows[0];
  return row ? rowToVote(row) : null;
}

export class VoteRepository {
  constructor(private readonly pool: Db) {}

  /**
   * A vote is always created empty, so `vote.users` is not written here — the
   * ballots arrive one row at a time through {@link cast}.
   */
  async create(vote: Vote): Promise<void> {
    await this.pool.query(
      `INSERT INTO votes (id, description, author_id, closed, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [vote.id, vote.description, vote.authorId, vote.closed, vote.createdAt],
    );
  }

  async find(voteId: string): Promise<Vote | null> {
    return readVote(this.pool, voteId);
  }

  /**
   * Records a ballot. The vote row is locked first so that closing a vote and
   * casting a ballot cannot interleave: a ballot either lands before the vote
   * closes or is rejected, never both.
   */
  async cast(
    voteId: string,
    userId: string,
    choice: VoteChoice,
  ): Promise<CastResult> {
    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ closed: boolean }>(
        "SELECT closed FROM votes WHERE id = $1 FOR UPDATE",
        [voteId],
      );

      const vote = rows[0];
      if (!vote) return { ok: false, reason: "not_found" };
      if (vote.closed) return { ok: false, reason: "closed" };

      await client.query(
        `INSERT INTO vote_ballots (vote_id, user_id, choice)
         VALUES ($1, $2, $3)
         ON CONFLICT (vote_id, user_id) DO UPDATE
           SET choice = EXCLUDED.choice, cast_at = now()`,
        [voteId, userId, choice === "yes"],
      );

      const updated = await readVote(client, voteId);
      return updated
        ? { ok: true, vote: updated }
        : { ok: false, reason: "not_found" };
    });
  }

  /** Closes a vote. Returns the final state, or `null` if it was already closed. */
  async close(voteId: string): Promise<Vote | null> {
    return withTransaction(this.pool, async (client) => {
      // `AND NOT closed` makes this idempotent: a second click on "end"
      // affects no rows and reports nothing to close.
      const { rowCount } = await client.query(
        "UPDATE votes SET closed = true WHERE id = $1 AND NOT closed",
        [voteId],
      );
      if (!rowCount) return null;

      return readVote(client, voteId);
    });
  }
}
