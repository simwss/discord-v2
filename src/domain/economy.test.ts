import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import { GameRuleError } from "../core/errors.js";
import { HOUR_MS } from "../core/clock.js";
import {
  assertValidStake,
  assertValidTransfer,
  isCooldownActive,
  MAX_STAKE,
  WORK,
} from "./economy.js";

describe("WORK", () => {
  it("keeps /work on a rolling one-hour cooldown", () => {
    expect(WORK.hourly.nextAvailableAt(1_000)).toBe(1_000 + HOUR_MS);
  });

  it("resets /daily at the next 00:00 UTC", () => {
    const claimedAt = Date.UTC(2026, 10, 13, 23, 59);
    expect(WORK.daily.nextAvailableAt(claimedAt)).toBe(Date.UTC(2026, 10, 14));
    expect(WORK.daily.nextAvailableAt(Date.UTC(2026, 10, 14))).toBe(
      Date.UTC(2026, 10, 15),
    );
  });

  it("resets /weekly on the next Monday at 00:00 UTC", () => {
    // 2026-11-13 is a Friday, 2026-11-16 a Monday.
    const friday = Date.UTC(2026, 10, 13, 12);
    expect(WORK.weekly.nextAvailableAt(friday)).toBe(Date.UTC(2026, 10, 16));
    expect(WORK.weekly.nextAvailableAt(Date.UTC(2026, 10, 16))).toBe(
      Date.UTC(2026, 10, 23),
    );
    expect(WORK.weekly.nextAvailableAt(Date.UTC(2026, 10, 15, 23))).toBe(
      Date.UTC(2026, 10, 16),
    );
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
  const hourly = WORK.hourly.nextAvailableAt;

  it("is inactive for a user who never claimed", () => {
    expect(isCooldownActive(0, hourly, 5_000)).toBe(false);
  });

  it("is active inside the window and inactive at the boundary", () => {
    expect(isCooldownActive(1_000, hourly, 1_000 + HOUR_MS - 1)).toBe(true);
    expect(isCooldownActive(1_000, hourly, 1_000 + HOUR_MS)).toBe(false);
  });

  it("frees /daily at midnight UTC even if the claim was minutes earlier", () => {
    const claimedAt = Date.UTC(2026, 10, 13, 23, 50);
    const daily = WORK.daily.nextAvailableAt;
    expect(
      isCooldownActive(claimedAt, daily, Date.UTC(2026, 10, 13, 23, 59)),
    ).toBe(true);
    expect(isCooldownActive(claimedAt, daily, Date.UTC(2026, 10, 14))).toBe(
      false,
    );
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
