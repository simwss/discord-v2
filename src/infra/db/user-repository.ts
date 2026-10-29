import type { PoolClient } from "pg";
import type { Db } from "./pool.js";
import { withTransaction } from "./transaction.js";
import {
  buildUserUpdate,
  MINER_COLUMN,
  rowToProfile,
  WORK_COLUMN,
  type UserPatch,
  type UserRow,
} from "./user-row.js";
import {
  STARTING_BALANCE,
  type MinerType,
  type UserProfile,
  type WorkKind,
} from "../../domain/user.js";
import { MINERS, sellPrice } from "../../domain/miners.js";

/** A mutation that either writes the given columns or aborts, carrying a result. */
interface Mutation<T> {
  readonly patch: UserPatch | undefined;
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

export type SaleResult =
  | {
      readonly ok: true;
      readonly balance: number;
      readonly owned: number;
      readonly proceeds: number;
    }
  | {
      readonly ok: false;
      readonly reason: "not_enough_miners";
      readonly owned: number;
    };

export type TransferOutcome =
  | { readonly ok: true; readonly senderBalance: number }
  | {
      readonly ok: false;
      readonly reason: "insufficient_funds" | "receiver_unknown";
    };

/**
 * Inserts the user if they are new and locks the row either way.
 *
 * `ON CONFLICT DO UPDATE` takes the same row lock a `SELECT ... FOR UPDATE`
 * would, which is why the no-op assignment is there: it turns "create or read"
 * into a single statement that also serialises concurrent callers. Inside a
 * transaction, the lock is held until commit.
 */
const UPSERT_AND_LOCK = `
  INSERT INTO users (id, balance) VALUES ($1, $2)
  ON CONFLICT (id) DO UPDATE SET id = users.id
  RETURNING *
`;

/**
 * Every balance change goes through a transaction holding a row lock.
 *
 * v1 used read-then-write, which loses updates: two commands running
 * concurrently for the same user both read the old balance and the second
 * write silently discards the first. That let a user place several
 * full-balance bets at once, and let `/daily` be claimed repeatedly by
 * spamming the command. Locking the row makes the second command wait and
 * then see the first one's result.
 *
 * The `balance >= 0` CHECK constraint in the schema is the backstop: even a
 * bug in the guards below cannot leave a negative balance in the database.
 */
export class UserRepository {
  constructor(private readonly pool: Db) {}

  /** Applies `mutate` to the user row atomically. */
  private async mutate<T>(
    userId: string,
    mutate: (row: UserRow) => Mutation<T>,
  ): Promise<T> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockUser(client, userId);
      const { patch, result } = mutate(row);

      if (patch) {
        const update = buildUserUpdate(userId, patch);
        if (update) await client.query(update.text, [...update.values]);
      }

      return result;
    });
  }

  /** Reads a profile, creating the record with a starting balance if absent. */
  async ensure(userId: string): Promise<UserProfile> {
    const { rows } = await this.pool.query<UserRow>(UPSERT_AND_LOCK, [
      userId,
      STARTING_BALANCE,
    ]);
    const row = rows[0];
    if (!row) throw new Error(`Upsert of user ${userId} returned no row`);
    return rowToProfile(row);
  }

  /** Reads a profile without creating it. Returns `null` for unknown users. */
  async find(userId: string): Promise<UserProfile | null> {
    const { rows } = await this.pool.query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [userId],
    );
    const row = rows[0];
    return row ? rowToProfile(row) : null;
  }

  async isAuthorised(userId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ authorised: boolean }>(
      "SELECT authorised FROM users WHERE id = $1",
      [userId],
    );
    return rows[0]?.authorised ?? false;
  }

  async setAuthorised(userId: string, authorised: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, balance, authorised) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET authorised = EXCLUDED.authorised, updated_at = now()`,
      [userId, STARTING_BALANCE, authorised],
    );
  }

  /**
   * Adds `delta` to the balance. A negative delta is rejected outright when
   * the user cannot cover it, rather than driving the balance negative.
   */
  async adjustBalance(userId: string, delta: number): Promise<BalanceChange> {
    return this.mutate<BalanceChange>(userId, (row) => {
      const next = row.balance + delta;

      if (next < 0) {
        return {
          patch: undefined,
          result: { ok: false, reason: "insufficient_funds" },
        };
      }

      return { patch: { balance: next }, result: { ok: true, balance: next } };
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
   * Claims a work reward, checking the cooldown while holding the row lock so
   * the command cannot be double-claimed by firing it twice in the same
   * instant.
   */
  async claimWork(params: {
    userId: string;
    kind: WorkKind;
    cooldownMs: number;
    amount: number;
    now: number;
  }): Promise<ClaimResult> {
    const column = WORK_COLUMN[params.kind];

    return this.mutate<ClaimResult>(params.userId, (row) => {
      const lastClaimedAt = row[column];

      if (lastClaimedAt > 0 && params.now - lastClaimedAt < params.cooldownMs) {
        return {
          patch: undefined,
          result: {
            ok: false,
            reason: "cooldown",
            nextAt: lastClaimedAt + params.cooldownMs,
          },
        };
      }

      const balance = row.balance + params.amount;
      return {
        patch: { balance, [column]: params.now },
        result: { ok: true, amount: params.amount, balance },
      };
    });
  }

  /**
   * Claims mining output. The amount depends on elapsed time, so it is
   * computed from the locked row rather than passed in.
   */
  async claimMining(params: {
    userId: string;
    cooldownMs: number;
    now: number;
    computeAmount: (profile: UserProfile) => number;
  }): Promise<ClaimResult> {
    return this.mutate<ClaimResult>(params.userId, (row) => {
      if (
        row.last_mine_at > 0 &&
        params.now - row.last_mine_at < params.cooldownMs
      ) {
        return {
          patch: undefined,
          result: {
            ok: false,
            reason: "cooldown",
            nextAt: row.last_mine_at + params.cooldownMs,
          },
        };
      }

      const amount = params.computeAmount(rowToProfile(row));
      const balance = row.balance + amount;

      return {
        patch: { balance, last_mine_at: params.now },
        result: { ok: true, amount, balance },
      };
    });
  }

  /** Buys one miner, checking affordability while holding the row lock. */
  async purchaseMiner(
    userId: string,
    type: MinerType,
  ): Promise<PurchaseResult> {
    const column = MINER_COLUMN[type];
    const { cost } = MINERS[type];

    return this.mutate<PurchaseResult>(userId, (row) => {
      if (row.balance < cost) {
        return {
          patch: undefined,
          result: { ok: false, reason: "insufficient_funds" },
        };
      }

      const owned = row[column] + 1;
      const balance = row.balance - cost;

      return {
        patch: { balance, [column]: owned },
        result: { ok: true, balance, owned },
      };
    });
  }

  /**
   * Sells `count` miners of one type for half their purchase price, checking
   * ownership while holding the row lock so the same miner cannot be sold
   * twice by concurrent commands.
   */
  async sellMiners(
    userId: string,
    type: MinerType,
    count: number,
  ): Promise<SaleResult> {
    const column = MINER_COLUMN[type];

    return this.mutate<SaleResult>(userId, (row) => {
      const current = row[column];
      if (current < count) {
        return {
          patch: undefined,
          result: { ok: false, reason: "not_enough_miners", owned: current },
        };
      }

      const proceeds = sellPrice(type, count);
      const owned = current - count;
      const balance = row.balance + proceeds;

      return {
        patch: { balance, [column]: owned },
        result: { ok: true, balance, owned, proceeds },
      };
    });
  }

  /**
   * Moves money between two existing users as one atomic step.
   *
   * v2.0 could not do this: the Realtime Database only transacts over a single
   * subtree, so a transfer was a debit followed by a credit followed by a
   * compensating refund if the credit failed. Here both rows are locked by one
   * statement — `ORDER BY id` gives every caller the same lock order, so two
   * people paying each other at the same instant queue up instead of
   * deadlocking — and either both balances move or neither does.
   */
  async transfer(
    senderId: string,
    receiverId: string,
    amount: number,
  ): Promise<TransferOutcome> {
    // Callers reject self-transfers before reaching here, so the two ids are
    // always distinct and the lock always covers two rows.
    await this.ensure(senderId);

    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ id: string; balance: number }>(
        `SELECT id, balance FROM users
         WHERE id = ANY($1::text[])
         ORDER BY id
         FOR UPDATE`,
        [[senderId, receiverId]],
      );

      const sender = rows.find((row) => row.id === senderId);
      const receiver = rows.find((row) => row.id === receiverId);
      if (!sender || !receiver) {
        return { ok: false, reason: "receiver_unknown" };
      }

      if (sender.balance < amount) {
        return { ok: false, reason: "insufficient_funds" };
      }

      const senderBalance = sender.balance - amount;
      await client.query(
        "UPDATE users SET balance = $2, updated_at = now() WHERE id = $1",
        [senderId, senderBalance],
      );
      await client.query(
        "UPDATE users SET balance = balance + $2, updated_at = now() WHERE id = $1",
        [receiverId, amount],
      );

      return { ok: true, senderBalance };
    });
  }

  /**
   * The richest `limit` users, for the leaderboard. v2.0 pulled every profile
   * over the wire and sorted in memory; this is an index scan.
   */
  async topByBalance(limit: number): Promise<UserProfile[]> {
    const { rows } = await this.pool.query<UserRow>(
      "SELECT * FROM users ORDER BY balance DESC, id ASC LIMIT $1",
      [limit],
    );
    return rows.map(rowToProfile);
  }
}

async function lockUser(client: PoolClient, userId: string): Promise<UserRow> {
  const { rows } = await client.query<UserRow>(UPSERT_AND_LOCK, [
    userId,
    STARTING_BALANCE,
  ]);
  const row = rows[0];
  if (!row) throw new Error(`Upsert of user ${userId} returned no row`);
  return row;
}
