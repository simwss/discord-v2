import { DAY_MS, startOfUtcDay } from "../core/clock.js";

export const STREAK_BONUS_PER_DAY = 500;

/** The bonus stops growing after this many consecutive days. */
export const MAX_STREAK_BONUS_DAYS = 10;

/**
 * /daily resets at 00:00 UTC, so a streak continues when the previous claim
 * was made on the UTC day before this one.
 */
export function nextDailyStreak(
  lastClaimedAt: number,
  previousStreak: number,
  now: number,
): number {
  const continues =
    lastClaimedAt > 0 &&
    startOfUtcDay(lastClaimedAt) === startOfUtcDay(now) - DAY_MS;
  return continues ? previousStreak + 1 : 1;
}

/** Extra payout on top of the regular daily reward. Day one earns nothing. */
export function dailyStreakBonus(streak: number): number {
  const days = Math.min(Math.max(streak - 1, 0), MAX_STREAK_BONUS_DAYS);
  return days * STREAK_BONUS_PER_DAY;
}
