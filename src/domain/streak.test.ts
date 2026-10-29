import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS } from "../core/clock.js";
import {
  dailyStreakBonus,
  MAX_STREAK_BONUS_DAYS,
  nextDailyStreak,
  STREAK_BONUS_PER_DAY,
} from "./streak.js";

describe("nextDailyStreak", () => {
  it("starts at one for a first claim", () => {
    expect(nextDailyStreak(0, 0, 10 * DAY_MS)).toBe(1);
  });

  it("continues when claimed within two days", () => {
    expect(nextDailyStreak(DAY_MS, 4, DAY_MS + 30 * HOUR_MS)).toBe(5);
  });

  it("resets after two days without a claim", () => {
    expect(nextDailyStreak(DAY_MS, 4, 3 * DAY_MS)).toBe(1);
  });
});

describe("dailyStreakBonus", () => {
  it("is zero on the first day", () => {
    expect(dailyStreakBonus(1)).toBe(0);
  });

  it("grows by a fixed amount per day", () => {
    expect(dailyStreakBonus(4)).toBe(3 * STREAK_BONUS_PER_DAY);
  });

  it("is capped", () => {
    expect(dailyStreakBonus(100)).toBe(
      MAX_STREAK_BONUS_DAYS * STREAK_BONUS_PER_DAY,
    );
  });
});
