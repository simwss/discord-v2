import { z } from "zod";
import type { Db } from "./pool.js";
import { SUITS, type BlackjackState } from "../../domain/blackjack.js";

const cardSchema = z.object({
  rank: z.number().int().min(1).max(13),
  suit: z.enum(SUITS),
});

/**
 * The hand is stored as three `jsonb` columns, so its contents are the one part
 * of the schema Postgres does not constrain. Validating on read keeps a row
 * written by an incompatible version from reaching the game rules.
 */
const stateSchema = z.object({
  stake: z.number().int().positive(),
  deck: z.array(cardSchema),
  dealer: z.array(cardSchema),
  player: z.array(cardSchema),
  status: z.enum(["playing", "finished"]),
  outcome: z.enum(["natural", "won", "push", "lost"]).nullable().default(null),
});

interface GameRow {
  stake: number;
  deck: unknown;
  dealer: unknown;
  player: unknown;
  status: string;
  outcome: string | null;
}

export class BlackjackRepository {
  constructor(private readonly pool: Db) {}

  async find(userId: string): Promise<BlackjackState | null> {
    const { rows } = await this.pool.query<GameRow>(
      `SELECT stake, deck, dealer, player, status, outcome
       FROM blackjack_games WHERE user_id = $1`,
      [userId],
    );

    const row = rows[0];
    if (!row) return null;

    const parsed = stateSchema.safeParse(row);
    if (!parsed.success) {
      // An unparseable record is unplayable; drop it so the user is not
      // permanently locked out of starting a new hand.
      await this.clear(userId);
      return null;
    }
    return parsed.data;
  }

  async save(userId: string, state: BlackjackState): Promise<void> {
    await this.pool.query(
      `INSERT INTO blackjack_games
         (user_id, stake, deck, dealer, player, status, outcome)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7)
       ON CONFLICT (user_id) DO UPDATE
         SET stake   = EXCLUDED.stake,
             deck    = EXCLUDED.deck,
             dealer  = EXCLUDED.dealer,
             player  = EXCLUDED.player,
             status  = EXCLUDED.status,
             outcome = EXCLUDED.outcome,
             updated_at = now()`,
      [
        userId,
        state.stake,
        // node-postgres would send a JS array as a Postgres array, which is a
        // different type from jsonb; serialise explicitly.
        JSON.stringify(state.deck),
        JSON.stringify(state.dealer),
        JSON.stringify(state.player),
        state.status,
        state.outcome,
      ],
    );
  }

  async clear(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM blackjack_games WHERE user_id = $1", [
      userId,
    ]);
  }
}
