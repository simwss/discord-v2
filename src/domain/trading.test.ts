import { describe, expect, it } from "vitest";
import { GameRuleError } from "../core/errors.js";
import {
  assertValidOrder,
  isLiquidated,
  liquidationPrice,
  MAX_LEVERAGE,
  profitAndLoss,
  settlePosition,
  tradingFee,
} from "./trading.js";

const long = {
  side: "long",
  leverage: 10,
  margin: 1_000,
  entryPrice: 100,
} as const;
const short = { ...long, side: "short" } as const;

describe("assertValidOrder", () => {
  it("accepts a normal order", () => {
    expect(() => {
      assertValidOrder(1_000, 10);
    }).not.toThrow();
  });

  it("rejects bad stakes and leverage", () => {
    for (const [margin, leverage] of [
      [0, 1],
      [1.5, 1],
      [100, 0],
      [100, MAX_LEVERAGE + 1],
      [100, 2.5],
    ] as const) {
      expect(() => {
        assertValidOrder(margin, leverage);
      }).toThrow(GameRuleError);
    }
  });
});

describe("tradingFee", () => {
  it("is a share of the leveraged position", () => {
    expect(tradingFee(10_000, 100)).toBe(500);
    expect(tradingFee(10_000, 1)).toBe(5);
  });

  it("is never below 1$", () => {
    expect(tradingFee(1, 1)).toBe(1);
  });
});

describe("profitAndLoss", () => {
  it("multiplies the price change by the leverage", () => {
    expect(profitAndLoss(long, 105)).toBe(500);
    expect(profitAndLoss(long, 95)).toBe(-500);
  });

  it("mirrors the result for shorts", () => {
    expect(profitAndLoss(short, 95)).toBe(500);
    expect(profitAndLoss(short, 105)).toBe(-500);
  });
});

describe("liquidation", () => {
  it("sits at a 90% loss of the stake", () => {
    expect(liquidationPrice(long)).toBeCloseTo(91);
    expect(liquidationPrice(short)).toBeCloseTo(109);
  });

  it("triggers at or beyond the liquidation price", () => {
    expect(isLiquidated(long, 91.5)).toBe(false);
    expect(isLiquidated(long, 90)).toBe(true);
    expect(isLiquidated(short, 108)).toBe(false);
    expect(isLiquidated(short, 110)).toBe(true);
  });

  it("needs only a 0.9% move at 100x", () => {
    const risky = { ...long, leverage: 100 };
    expect(isLiquidated(risky, 99.2)).toBe(false);
    expect(isLiquidated(risky, 99.1)).toBe(true);
  });
});

describe("settlePosition", () => {
  it("pays back stake plus profit minus the closing fee", () => {
    expect(settlePosition(long, 110)).toEqual({
      outcome: "closed",
      pnl: 1_000,
      fee: 5,
      payout: 1_995,
    });
  });

  it("pays back the rest of the stake on a loss", () => {
    expect(settlePosition(long, 95).payout).toBe(495);
  });

  it("never loses more than the stake, even after a price gap", () => {
    expect(settlePosition(long, 1)).toEqual({
      outcome: "liquidated",
      pnl: -1_000,
      fee: 0,
      payout: 0,
    });
    expect(settlePosition(short, 500).payout).toBe(0);
  });
});
