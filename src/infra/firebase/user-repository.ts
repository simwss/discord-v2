import {
  get,
  ref,
  runTransaction,
  update,
  type Database,
} from "firebase/database";
import { paths } from "./paths.js";
import {
  minerField,
  newUserRecord,
  toProfile,
  workField,
  type MinerType,
  type UserProfile,
  type WorkKind,
} from "../../domain/user.js";
import { MINERS } from "../../domain/miners.js";

/** A mutation that either writes a new record or aborts, carrying a result. */
interface Mutation<T> {
  readonly record: Record<string, unknown> | undefined;
  readonly result: T;
}

export type BalanceChange =
  | { readonly ok: true; readonly balance: number }
  | { readonly ok: false; readonly reason: "insufficient_funds" };

export type ClaimResult =
  | { readonly ok: true; readonly amount: number; readonly balance: number }
  | {
      readonly ok: false;
      readonly reason: "cooldown";
      readonly nextAt: number;
    };

export type PurchaseResult =
  | { readonly ok: true; readonly balance: number; readonly owned: number }
  | { readonly ok: false; readonly reason: "insufficient_funds" };

/**
 * Every balance change goes through a Realtime Database transaction.
 *
 * v1 used read-then-write (`get` followed by `set`), which loses updates: two
 * commands running concurrently for the same user both read the old balance
 * and the second write silently discards the first. That let a user place
 * several full-balance bets at once, and let `/daily` be claimed repeatedly by
 * spamming the command. A transaction re-runs against the committed server
 * value, so neither is possible.
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  /**
   * Applies `mutate` to the user record atomically.
   *
   * The handler is invoked with `null` on its first pass when the local cache
   * is cold, and re-invoked with server data if the write collides, so it must
   * be a pure function of the record it is given.
   */
  private async mutate<T>(
    userId: string,
    mutate: (record: Record<string, unknown>) => Mutation<T>,
  ): Promise<T> {
    const userRef = ref(this.db, paths.user(userId));
    // Held in an object rather than a bare local so the value survives the
    // callback boundary without the compiler narrowing it away.
    const captured: { outcome?: Mutation<T> } = {};

    await runTransaction(userRef, (current: unknown) => {
      const record =
        current === null || typeof current !== "object"
          ? (newUserRecord(userId) as unknown as Record<string, unknown>)
          : { ...(current as Record<string, unknown>), id: userId };

      const outcome = mutate(record);
      captured.outcome = outcome;
      return outcome.record;
    });

    if (!captured.outcome) {
      throw new Error(`Transaction for user ${userId} never ran`);
    }
    return captured.outcome.result;
  }

  /** Reads a profile, creating the record with a starting balance if absent. */
  async ensure(userId: string): Promise<UserProfile> {
    return this.mutate(userId, (record) => ({
      record,
      result: toProfile(userId, record),
    }));
  }

  /** Reads a profile without creating it. Returns `null` for unknown users. */
  async find(userId: string): Promise<UserProfile | null> {
    const snapshot = await get(ref(this.db, paths.user(userId)));
    if (!snapshot.exists()) return null;
    return toProfile(userId, snapshot.val());
  }

  async isAuthorised(userId: string): Promise<boolean> {
    const profile = await this.find(userId);
    return profile?.authorised ?? false;
  }

  async setAuthorised(userId: string, authorised: boolean): Promise<void> {
    await update(ref(this.db, paths.user(userId)), { authorised });
  }

  /**
   * Adds `delta` to the balance. A negative delta is rejected outright when
   * the user cannot cover it, rather than driving the balance negative.
   */
  async adjustBalance(userId: string, delta: number): Promise<BalanceChange> {
    return this.mutate<BalanceChange>(userId, (record) => {
      const balance = readNumber(record.balance);
      const next = balance + delta;

      if (next < 0) {
        return {
          record: undefined,
          result: { ok: false, reason: "insufficient_funds" },
        };
      }

      return {
        record: { ...record, balance: next },
        result: { ok: true, balance: next },
      };
    });
  }

  /** Debits a wager up front so concurrent games cannot reuse the same funds. */
  async debitStake(userId: string, stake: number): Promise<BalanceChange> {
    return this.adjustBalance(userId, -stake);
  }

  /** Credits winnings. Always succeeds. */
  async credit(userId: string, amount: number): Promise<number> {
    const result = await this.adjustBalance(userId, amount);
    if (!result.ok) {
      throw new Error(`Credit of ${amount} to ${userId} was rejected`);
    }
    return result.balance;
  }

  /**
   * Claims a work reward, checking the cooldown inside the transaction so the
   * command cannot be double-claimed by firing it twice in the same instant.
   */
  async claimWork(params: {
    userId: string;
    kind: WorkKind;
    cooldownMs: number;
    amount: number;
    now: number;
  }): Promise<ClaimResult> {
    const field = workField(params.kind);

    return this.mutate<ClaimResult>(params.userId, (record) => {
      const lastClaimedAt = readNumber(record[field]);

      if (lastClaimedAt > 0 && params.now - lastClaimedAt < params.cooldownMs) {
        return {
          record: undefined,
          result: {
            ok: false,
            reason: "cooldown",
            nextAt: lastClaimedAt + params.cooldownMs,
          },
        };
      }

      const balance = readNumber(record.balance) + params.amount;
      return {
        record: { ...record, balance, [field]: params.now },
        result: { ok: true, amount: params.amount, balance },
      };
    });
  }

  /**
   * Claims mining output. The amount depends on elapsed time, so it is
   * computed from the record inside the transaction rather than passed in.
   */
  async claimMining(params: {
    userId: string;
    cooldownMs: number;
    now: number;
    computeAmount: (profile: UserProfile) => number;
  }): Promise<ClaimResult> {
    return this.mutate<ClaimResult>(params.userId, (record) => {
      const lastMineAt = readNumber(record.lastMine);

      if (lastMineAt > 0 && params.now - lastMineAt < params.cooldownMs) {
        return {
          record: undefined,
          result: {
            ok: false,
            reason: "cooldown",
            nextAt: lastMineAt + params.cooldownMs,
          },
        };
      }

      const profile = toProfile(params.userId, record);
      const amount = params.computeAmount(profile);
      const balance = profile.balance + amount;

      return {
        record: { ...record, balance, lastMine: params.now },
        result: { ok: true, amount, balance },
      };
    });
  }

  /** Buys one miner, checking affordability inside the transaction. */
  async purchaseMiner(
    userId: string,
    type: MinerType,
  ): Promise<PurchaseResult> {
    const field = minerField(type);
    const { cost } = MINERS[type];

    return this.mutate<PurchaseResult>(userId, (record) => {
      const balance = readNumber(record.balance);

      if (balance < cost) {
        return {
          record: undefined,
          result: { ok: false, reason: "insufficient_funds" },
        };
      }

      const owned = readNumber(record[field]) + 1;
      const next = balance - cost;

      return {
        record: { ...record, balance: next, [field]: owned },
        result: { ok: true, balance: next, owned },
      };
    });
  }

  /** All profiles, for the leaderboard. */
  async listAll(): Promise<UserProfile[]> {
    const snapshot = await get(ref(this.db, paths.users()));
    const raw = snapshot.val() as Record<string, unknown> | null;
    if (!raw) return [];
    return Object.entries(raw).map(([id, value]) => toProfile(id, value));
  }
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
