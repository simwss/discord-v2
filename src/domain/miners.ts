import { DAY_MS } from "../core/clock.js";
import { MINER_TYPES, type MinerType, type UserProfile } from "./user.js";
import type { Rng } from "../core/random.js";

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
  /** Time span the payout covers, in milliseconds. */
  readonly elapsedMs: number;
  readonly amount: number;
}

/**
 * Earnings accrued since the last collection. Callers must check the
 * cooldown first — this assumes collection is allowed.
 *
 * The payout is prorated over the exact elapsed time rather than whole days:
 * collecting after 30h credits 30h of yield, so the leftover 6h are not lost
 * when `lastMineAt` moves to now. Only the sub-coin remainder is dropped.
 */
export function computeMiningYield(
  profile: UserProfile,
  now: number,
): MiningResult {
  // A user who has never collected has nothing to accrue from, so the first
  // collection seeds a single day.
  const elapsedMs =
    profile.lastMineAt === 0 ? DAY_MS : Math.max(0, now - profile.lastMineAt);
  return {
    elapsedMs,
    amount: Math.floor((dailyYield(profile.miners) * elapsedMs) / DAY_MS),
  };
}

/** Selling returns half of the purchase price, rounded down. */
export const SELL_RATIO = 0.5;

export function sellPrice(type: MinerType, count = 1): number {
  return Math.floor(MINERS[type].cost * SELL_RATIO) * count;
}

const CHILD_EMOJIS = ["🧒", "👦", "👧"] as const;
const SKIN_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"] as const;

/** A child emoji with a random skin tone, shown next to the miners. */
export function minerEmoji(rng: Rng): string {
  return `${rng.pick(CHILD_EMOJIS)}${rng.pick(SKIN_TONES)}`;
}
