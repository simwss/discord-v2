import { DAY_MS } from "../core/clock.js";

/**
 * A streak survives as long as the next /daily lands within this window of
 * the previous one. The cooldown is one day, so this leaves a full day of
 * slack before the streak breaks.
 */
export const DAILY_STREAK_WINDOW_MS = 2 * DAY_MS;

export const STREAK_BONUS_PER_DAY = 500;

/** The bonus stops growing after this many consecutive days. */
export const MAX_STREAK_BONUS_DAYS = 10;

export function nextDailyStreak(
  lastClaimedAt: number,
  previousStreak: number,
  now: number,
): number {
  const continues =
    lastClaimedAt > 0 && now - lastClaimedAt < DAILY_STREAK_WINDOW_MS;
  return continues ? previousStreak + 1 : 1;
}

/** Extra payout on top of the regular daily reward. Day one earns nothing. */
export function dailyStreakBonus(streak: number): number {
  const days = Math.min(Math.max(streak - 1, 0), MAX_STREAK_BONUS_DAYS);
  return days * STREAK_BONUS_PER_DAY;
}
