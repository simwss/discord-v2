import { get, ref, runTransaction, type Database } from "firebase/database";
import { paths } from "./paths.js";
import { voteSchema, type Vote, type VoteChoice } from "../../domain/vote.js";

export type CastResult =
  | { readonly ok: true; readonly vote: Vote }
  | { readonly ok: false; readonly reason: "not_found" | "closed" };

export class VoteRepository {
  constructor(private readonly db: Database) {}

  async create(vote: Vote): Promise<void> {
    await runTransaction(ref(this.db, paths.vote(vote.id)), () => vote);
  }

  async find(voteId: string): Promise<Vote | null> {
    const snapshot = await get(ref(this.db, paths.vote(voteId)));
    if (!snapshot.exists()) return null;
    const parsed = voteSchema.safeParse(snapshot.val());
    return parsed.success ? parsed.data : null;
  }

  /**
   * Records a ballot. Run as a transaction so two people voting at the same
   * instant do not overwrite each other's ballot.
   */
  async cast(
    voteId: string,
    userId: string,
    choice: VoteChoice,
  ): Promise<CastResult> {
    let captured: CastResult = { ok: false, reason: "not_found" };

    await runTransaction(
      ref(this.db, paths.vote(voteId)),
      (current: unknown) => {
        if (current === null) {
          captured = { ok: false, reason: "not_found" };
          return undefined;
        }

        const parsed = voteSchema.safeParse(current);
        if (!parsed.success) {
          captured = { ok: false, reason: "not_found" };
          return undefined;
        }

        if (parsed.data.closed) {
          captured = { ok: false, reason: "closed" };
          return undefined;
        }

        const next: Vote = {
          ...parsed.data,
          users: { ...parsed.data.users, [userId]: choice === "yes" },
        };
        captured = { ok: true, vote: next };
        return next;
      },
    );

    return captured;
  }

  /** Closes a vote. Returns the final state, or `null` if it was already closed. */
  async close(voteId: string): Promise<Vote | null> {
    let captured: Vote | null = null;

    await runTransaction(
      ref(this.db, paths.vote(voteId)),
      (current: unknown) => {
        if (current === null) return undefined;

        const parsed = voteSchema.safeParse(current);
        if (!parsed.success || parsed.data.closed) return undefined;

        const next: Vote = { ...parsed.data, closed: true };
        captured = next;
        return next;
      },
    );

    return captured;
  }
}
