import { z } from "zod";

export const MINER_TYPES = ["basic", "elite", "deluxe"] as const;
export type MinerType = (typeof MINER_TYPES)[number];

export const WORK_KINDS = ["hourly", "daily", "weekly"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/** The in-memory model the rest of the app works with. Always fully populated. */
export interface UserProfile {
  id: string;
  balance: number;
  authorised: boolean;
  miners: Record<MinerType, number>;
  lastMineAt: number;
  workClaimedAt: Record<WorkKind, number>;
}

export const STARTING_BALANCE = 1000;

/**
 * Shape as stored in the Realtime Database. Kept flat and backwards
 * compatible with the v1 schema so no data migration is needed.
 *
 * Every field is optional on read: RTDB omits keys whose value is falsy in
 * some write paths, and v1 records predate several of these fields. The
 * defaults here are what stopped `undefined + number = NaN` bugs from
 * reaching the balance column.
 */
const storedUserSchema = z.object({
  id: z.string().optional(),
  balance: z.number().catch(STARTING_BALANCE).default(STARTING_BALANCE),
  authorised: z.boolean().catch(false).default(false),
  basicMiners: z.number().int().nonnegative().catch(0).default(0),
  eliteMiners: z.number().int().nonnegative().catch(0).default(0),
  deluxeMiners: z.number().int().nonnegative().catch(0).default(0),
  lastMine: z.number().nonnegative().catch(0).default(0),
  hourlyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
  dailyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
  weeklyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
});

export type StoredUser = z.infer<typeof storedUserSchema>;

const MINER_FIELD: Record<MinerType, keyof StoredUser> = {
  basic: "basicMiners",
  elite: "eliteMiners",
  deluxe: "deluxeMiners",
};

const WORK_FIELD: Record<WorkKind, keyof StoredUser> = {
  hourly: "hourlyWorkTimestamp",
  daily: "dailyWorkTimestamp",
  weekly: "weeklyWorkTimestamp",
};

/** Database field name holding the purchase count for a miner type. */
export function minerField(type: MinerType): string {
  return MINER_FIELD[type];
}

/** Database field name holding the last-claim timestamp for a work kind. */
export function workField(kind: WorkKind): string {
  return WORK_FIELD[kind];
}

/**
 * Parses a raw RTDB value into a fully populated profile. Never throws — it
 * runs inside transaction handlers, where a throw would abort the write, and
 * a corrupt node (a scalar where an object belongs) must degrade to defaults
 * rather than lock the user out.
 */
export function toProfile(id: string, raw: unknown): UserProfile {
  const isRecord =
    typeof raw === "object" && raw !== null && !Array.isArray(raw);
  const parsed = storedUserSchema.safeParse(isRecord ? raw : {});
  const stored = parsed.success ? parsed.data : storedUserSchema.parse({});

  return {
    id,
    balance: stored.balance,
    authorised: stored.authorised,
    miners: {
      basic: stored.basicMiners,
      elite: stored.eliteMiners,
      deluxe: stored.deluxeMiners,
    },
    lastMineAt: stored.lastMine,
    workClaimedAt: {
      hourly: stored.hourlyWorkTimestamp,
      daily: stored.dailyWorkTimestamp,
      weekly: stored.weeklyWorkTimestamp,
    },
  };
}

/** The record written for a user seen for the first time. */
export function newUserRecord(id: string): StoredUser & { id: string } {
  return {
    id,
    balance: STARTING_BALANCE,
    authorised: false,
    basicMiners: 0,
    eliteMiners: 0,
    deluxeMiners: 0,
    lastMine: 0,
    hourlyWorkTimestamp: 0,
    dailyWorkTimestamp: 0,
    weeklyWorkTimestamp: 0,
  };
}
