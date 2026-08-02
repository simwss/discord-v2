import { describe, expect, it } from "vitest";
import { DAY_MS } from "../core/clock.js";
import { computeMiningYield, dailyYield, MINERS } from "./miners.js";
import { toProfile } from "./user.js";

const profileWith = (
  miners: { basic?: number; elite?: number; deluxe?: number },
  lastMineAt = 0,
) =>
  toProfile("1", {
    basicMiners: miners.basic ?? 0,
    eliteMiners: miners.elite ?? 0,
    deluxeMiners: miners.deluxe ?? 0,
    lastMine: lastMineAt,
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
    expect(result.days).toBe(1);
    expect(result.amount).toBe(MINERS.basic.dailyEarnings);
  });

  it("credits whole elapsed days", () => {
    const lastMine = 1_000;
    const result = computeMiningYield(
      profileWith({ basic: 1 }, lastMine),
      lastMine + 3 * DAY_MS,
    );
    expect(result.days).toBe(3);
    expect(result.amount).toBe(3 * MINERS.basic.dailyEarnings);
  });

  it("never credits less than one day", () => {
    const lastMine = 1_000;
    const result = computeMiningYield(
      profileWith({ basic: 1 }, lastMine),
      lastMine + 1,
    );
    expect(result.days).toBe(1);
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
