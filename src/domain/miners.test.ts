import { describe, expect, it } from "vitest";
import { DAY_MS } from "../core/clock.js";
import { computeMiningYield, dailyYield, MINERS } from "./miners.js";
import { STARTING_BALANCE, type UserProfile } from "./user.js";

const profileWith = (
  miners: { basic?: number; elite?: number; deluxe?: number },
  lastMineAt = 0,
): UserProfile => ({
  id: "1",
  balance: STARTING_BALANCE,
  authorised: false,
  miners: {
    basic: miners.basic ?? 0,
    elite: miners.elite ?? 0,
    deluxe: miners.deluxe ?? 0,
  },
  lastMineAt,
  workClaimedAt: { hourly: 0, daily: 0, weekly: 0 },
});

describe("dailyYield", () => {
  it("is zero with no miners", () => {
    expect(dailyYield({ basic: 0, elite: 0, deluxe: 0 })).toBe(0);
  });

  it("sums every miner type", () => {
    expect(dailyYield({ basic: 2, elite: 1, deluxe: 1 })).toBe(
      2 * MINERS.basic.dailyEarnings +
        MINERS.elite.dailyEarnings +
        MINERS.deluxe.dailyEarnings,
    );
  });
});

describe("computeMiningYield", () => {
  it("credits a single day on the first ever collection", () => {
    const result = computeMiningYield(profileWith({ basic: 1 }), 5 * DAY_MS);
    expect(result.elapsedMs).toBe(DAY_MS);
    expect(result.amount).toBe(MINERS.basic.dailyEarnings);
  });

  it("credits whole elapsed days", () => {
    const lastMine = 1_000;
    const result = computeMiningYield(
      profileWith({ basic: 1 }, lastMine),
      lastMine + 3 * DAY_MS,
    );
    expect(result.elapsedMs).toBe(3 * DAY_MS);
    expect(result.amount).toBe(3 * MINERS.basic.dailyEarnings);
  });

  it("prorates the partial day instead of discarding it", () => {
    const lastMine = 1_000;
    const result = computeMiningYield(
      profileWith({ basic: 1 }, lastMine),
      lastMine + 1.5 * DAY_MS,
    );
    expect(result.elapsedMs).toBe(1.5 * DAY_MS);
    expect(result.amount).toBe(1.5 * MINERS.basic.dailyEarnings);
  });

  it("loses no yield when collections are split mid-day", () => {
    const oneShot = computeMiningYield(
      profileWith({ elite: 2 }, 0 + 1),
      1 + 5 * DAY_MS,
    ).amount;

    // Two collections spanning the same window must pay the same total.
    const first = computeMiningYield(
      profileWith({ elite: 2 }, 1),
      1 + 1.25 * DAY_MS,
    );
    const second = computeMiningYield(
      profileWith({ elite: 2 }, 1 + 1.25 * DAY_MS),
      1 + 5 * DAY_MS,
    );
    expect(first.amount + second.amount).toBe(oneShot);
  });

  it("credits a fraction of a day rather than a full one", () => {
    const lastMine = 1_000;
    const result = computeMiningYield(
      profileWith({ basic: 1 }, lastMine),
      lastMine + DAY_MS / 4,
    );
    expect(result.amount).toBe(MINERS.basic.dailyEarnings / 4);
  });

  it("pays nothing without miners", () => {
    expect(computeMiningYield(profileWith({}), DAY_MS).amount).toBe(0);
  });

  it("keeps every miner profitable within its payback period", () => {
    for (const miner of Object.values(MINERS)) {
      expect(miner.dailyEarnings).toBeGreaterThan(0);
      expect(miner.cost / miner.dailyEarnings).toBe(100);
    }
  });
});
