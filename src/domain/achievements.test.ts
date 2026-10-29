import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_ID,
  earnedAchievementIds,
} from "./achievements.js";
import { STARTING_BALANCE, type UserProfile } from "./user.js";

const baseProfile: UserProfile = {
  id: "1",
  balance: STARTING_BALANCE,
  authorised: false,
  miners: { basic: 0, elite: 0, deluxe: 0 },
  lastMineAt: 0,
  workClaimedAt: { hourly: 0, daily: 0, weekly: 0 },
  dailyStreak: 0,
  blackjackWinStreak: 0,
  lastRobAt: 0,
  robSuccesses: 0,
  robFailures: 0,
};

describe("earnedAchievementIds", () => {
  it("is empty for a fresh profile", () => {
    expect(earnedAchievementIds(baseProfile)).toEqual([]);
  });

  it("grants every achievement to a profile that meets all conditions", () => {
    const veteran: UserProfile = {
      ...baseProfile,
      balance: 1_000_000_000,
      miners: { basic: 1, elite: 0, deluxe: 1 },
      dailyStreak: 7,
      blackjackWinStreak: 10,
      robSuccesses: 1,
      robFailures: 1,
    };
    expect(earnedAchievementIds(veteran)).toEqual(
      ACHIEVEMENTS.map((a) => a.id),
    );
  });

  it("stops just below each threshold", () => {
    const almost: UserProfile = {
      ...baseProfile,
      balance: 999_999,
      dailyStreak: 6,
      blackjackWinStreak: 9,
    };
    expect(earnedAchievementIds(almost)).toEqual([]);
  });

  it("counts any miner type for the first miner", () => {
    expect(
      earnedAchievementIds({
        ...baseProfile,
        miners: { basic: 0, elite: 1, deluxe: 0 },
      }),
    ).toEqual(["first_miner"]);
  });
});

describe("achievement definitions", () => {
  it("have unique ids and short names", () => {
    expect(ACHIEVEMENTS_BY_ID.size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.name.length).toBeLessThanOrEqual(12);
    }
  });
});
