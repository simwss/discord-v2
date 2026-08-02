import { DAY_MS } from "../core/clock.js";
import { MINER_TYPES, type MinerType, type UserProfile } from "./user.js";

export interface MinerDefinition {
  readonly type: MinerType;
  readonly name: string;
  readonly cost: number;
  readonly dailyEarnings: number;
}

export const MINERS: Readonly<Record<MinerType, MinerDefinition>> = {
  basic: {
    type: "basic",
    name: "Basic Miner",
    cost: 1_000_000,
    dailyEarnings: 10_000,
  },
  elite: {
    type: "elite",
    name: "Elite Miner",
    cost: 10_000_000,
    dailyEarnings: 100_000,
  },
  deluxe: {
    type: "deluxe",
    name: "Deluxe Miner",
    cost: 100_000_000,
    dailyEarnings: 1_000_000,
  },
};

export const MINING_COOLDOWN_MS = DAY_MS;

/** Total payout per day across every miner the user owns. */
export function dailyYield(miners: Record<MinerType, number>): number {
  return MINER_TYPES.reduce(
    (sum, type) => sum + miners[type] * MINERS[type].dailyEarnings,
    0,
  );
}

export interface MiningResult {
  /** Whole days credited, at least 1 when off cooldown. */
  readonly days: number;
  readonly amount: number;
}

/**
 * Earnings accrued since the last collection. Callers must check the
 * cooldown first — this assumes collection is allowed.
 */
export function computeMiningYield(
  profile: UserProfile,
  now: number,
): MiningResult {
  const days =
    profile.lastMineAt === 0
      ? 1
      : Math.max(1, Math.floor((now - profile.lastMineAt) / DAY_MS));
  return { days, amount: dailyYield(profile.miners) * days };
}
