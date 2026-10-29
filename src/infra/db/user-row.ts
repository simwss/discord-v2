import type { MinerType, UserProfile, WorkKind } from "../../domain/user.js";

/**
 * A row of `users` as node-postgres returns it. The `bigint` columns arrive as
 * numbers because of the INT8 type parser installed in `pool.ts`.
 *
 * Nothing here is optional or nullable: every column is `NOT NULL` with a
 * default, which is what replaced v2.0's defensive parsing of half-populated
 * Realtime Database nodes. A record cannot be missing a balance any more.
 */
export interface UserRow {
  id: string;
  balance: number;
  authorised: boolean;
  basic_miners: number;
  elite_miners: number;
  deluxe_miners: number;
  last_mine_at: number;
  hourly_work_at: number;
  daily_work_at: number;
  weekly_work_at: number;
  daily_streak: number;
  blackjack_win_streak: number;
  last_rob_at: number;
  rob_successes: number;
  rob_failures: number;
}

/** Writable columns, and the only identifiers ever spliced into an UPDATE. */
export const USER_COLUMNS = [
  "balance",
  "authorised",
  "basic_miners",
  "elite_miners",
  "deluxe_miners",
  "last_mine_at",
  "hourly_work_at",
  "daily_work_at",
  "weekly_work_at",
  "daily_streak",
  "blackjack_win_streak",
  "last_rob_at",
  "rob_successes",
  "rob_failures",
] as const;

export type UserColumn = (typeof USER_COLUMNS)[number];

/** Columns to write. An absent key is left untouched. */
export type UserPatch = Partial<Record<UserColumn, number | boolean>>;

/**
 * Named narrowly rather than as plain `UserColumn` so that indexing a row with
 * one of them yields `number` and not `number | boolean`.
 */
export type MinerColumn = "basic_miners" | "elite_miners" | "deluxe_miners";
export type WorkColumn = "hourly_work_at" | "daily_work_at" | "weekly_work_at";

export const MINER_COLUMN: Record<MinerType, MinerColumn> = {
  basic: "basic_miners",
  elite: "elite_miners",
  deluxe: "deluxe_miners",
};

export const WORK_COLUMN: Record<WorkKind, WorkColumn> = {
  hourly: "hourly_work_at",
  daily: "daily_work_at",
  weekly: "weekly_work_at",
};

export function rowToProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    balance: row.balance,
    authorised: row.authorised,
    miners: {
      basic: row.basic_miners,
      elite: row.elite_miners,
      deluxe: row.deluxe_miners,
    },
    lastMineAt: row.last_mine_at,
    workClaimedAt: {
      hourly: row.hourly_work_at,
      daily: row.daily_work_at,
      weekly: row.weekly_work_at,
    },
    dailyStreak: row.daily_streak,
    blackjackWinStreak: row.blackjack_win_streak,
    lastRobAt: row.last_rob_at,
    robSuccesses: row.rob_successes,
    robFailures: row.rob_failures,
  };
}

export interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}

/**
 * Turns a patch into a parameterised UPDATE, or `null` when there is nothing
 * to write.
 *
 * Column names cannot be bound as parameters, so they are spliced into the
 * SQL — but only ever by filtering the fixed `USER_COLUMNS` list, so no
 * caller-supplied string can reach the statement text.
 */
export function buildUserUpdate(
  userId: string,
  patch: UserPatch,
): Statement | null {
  const columns = USER_COLUMNS.filter((column) => patch[column] !== undefined);
  if (columns.length === 0) return null;

  const assignments = columns
    .map((column, index) => `${column} = $${index + 2}`)
    .join(", ");

  return {
    text: `UPDATE users SET ${assignments}, updated_at = now() WHERE id = $1`,
    values: [userId, ...columns.map((column) => patch[column])],
  };
}
