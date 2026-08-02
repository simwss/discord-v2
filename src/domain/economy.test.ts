import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import { GameRuleError } from "../core/errors.js";
import { DAY_MS, HOUR_MS, WEEK_MS } from "../core/clock.js";
import {
  assertValidStake,
  assertValidTransfer,
  isCooldownActive,
  MAX_STAKE,
  nextAvailableAt,
  WORK,
} from "./economy.js";

describe("WORK", () => {
  it("uses the documented cooldowns", () => {
    expect(WORK.hourly.cooldownMs).toBe(HOUR_MS);
    expect(WORK.daily.cooldownMs).toBe(DAY_MS);
    expect(WORK.weekly.cooldownMs).toBe(WEEK_MS);
  });

  it("keeps the hourly reward in its advertised band", () => {
    const rng = seededRng(2);
    for (let i = 0; i < 500; i++) {
      const reward = WORK.hourly.reward(rng);
      expect(reward).toBeGreaterThanOrEqual(900);
      expect(reward).toBeLessThan(1000);
    }
  });

  it("pays fixed daily and weekly amounts", () => {
    const rng = seededRng(2);
    expect(WORK.daily.reward(rng)).toBe(5_000);
    expect(WORK.weekly.reward(rng)).toBe(100_000);
  });
});

describe("isCooldownActive", () => {
  it("is inactive for a user who never claimed", () => {
    expect(isCooldownActive(0, HOUR_MS, 5_000)).toBe(false);
  });

  it("is active inside the window and inactive at the boundary", () => {
    expect(isCooldownActive(1_000, HOUR_MS, 1_000 + HOUR_MS - 1)).toBe(true);
    expect(isCooldownActive(1_000, HOUR_MS, 1_000 + HOUR_MS)).toBe(false);
  });
});

describe("nextAvailableAt", () => {
  it("adds the cooldown to the last claim", () => {
    expect(nextAvailableAt(1_000, HOUR_MS)).toBe(1_000 + HOUR_MS);
  });
});

describe("assertValidStake", () => {
  it("accepts a covered whole-number stake", () => {
    expect(() => {
      assertValidStake(100, 100);
    }).not.toThrow();
  });

  it("rejects zero, negative and fractional stakes", () => {
    for (const stake of [0, -5, 1.5, Number.NaN]) {
      expect(() => {
        assertValidStake(stake, 1_000);
      }).toThrow(GameRuleError);
    }
  });

  it("rejects a stake above the balance", () => {
    expect(() => {
      assertValidStake(101, 100);
    }).toThrow(/nicht genug Geld/);
  });

  it("caps absurd stakes before they reach the ledger", () => {
    expect(() => {
      assertValidStake(MAX_STAKE + 1, Number.MAX_SAFE_INTEGER);
    }).toThrow(GameRuleError);
  });
});

describe("assertValidTransfer", () => {
  it("rejects non-positive amounts", () => {
    expect(() => {
      assertValidTransfer(0, 100);
    }).toThrow(GameRuleError);
    expect(() => {
      assertValidTransfer(-1, 100);
    }).toThrow(GameRuleError);
  });

  it("rejects more than the sender holds", () => {
    expect(() => {
      assertValidTransfer(101, 100);
    }).toThrow(/nicht genug Geld/);
  });

  it("accepts the full balance", () => {
    expect(() => {
      assertValidTransfer(100, 100);
    }).not.toThrow();
  });
});
