import { get, ref, remove, set, type Database } from "firebase/database";
import { z } from "zod";
import { paths } from "./paths.js";
import { SUITS, type BlackjackState } from "../../domain/blackjack.js";

const cardSchema = z.object({
  rank: z.number().int().min(1).max(13),
  suit: z.enum(SUITS),
});

const stateSchema = z.object({
  stake: z.number().int().positive(),
  deck: z.array(cardSchema),
  dealer: z.array(cardSchema),
  player: z.array(cardSchema),
  status: z.enum(["playing", "finished"]),
  outcome: z.enum(["natural", "won", "push", "lost"]).nullable().default(null),
});

export class BlackjackRepository {
  constructor(private readonly db: Database) {}

  async find(userId: string): Promise<BlackjackState | null> {
    const snapshot = await get(ref(this.db, paths.blackjackGame(userId)));
    if (!snapshot.exists()) return null;

    const parsed = stateSchema.safeParse(snapshot.val());
    if (!parsed.success) {
      // A record written by an incompatible version is unplayable; drop it so
      // the user is not permanently locked out of starting a new hand.
      await this.clear(userId);
      return null;
    }
    return parsed.data;
  }

  async save(userId: string, state: BlackjackState): Promise<void> {
    await set(ref(this.db, paths.blackjackGame(userId)), {
      stake: state.stake,
      deck: state.deck,
      dealer: state.dealer,
      player: state.player,
      status: state.status,
      outcome: state.outcome,
    });
  }

  async clear(userId: string): Promise<void> {
    await remove(ref(this.db, paths.blackjackGame(userId)));
  }
}
