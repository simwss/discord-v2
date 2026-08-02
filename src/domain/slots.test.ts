import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import {
  evaluate,
  REEL_COUNT,
  SLOT_SYMBOLS,
  spin,
  type Reels,
} from "./slots.js";

describe("spin", () => {
  it("returns one symbol per reel, all from the symbol set", () => {
    const rng = seededRng(21);
    for (let i = 0; i < 200; i++) {
      const reels = spin(rng);
      expect(reels).toHaveLength(REEL_COUNT);
      for (const symbol of reels) {
        expect(SLOT_SYMBOLS).toContain(symbol);
      }
    }
  });
});

describe("evaluate", () => {
  it("pays the symbol multiplier on three of a kind", () => {
    expect(evaluate(["🍒", "🍒", "🍒"], 100)).toMatchObject({
      won: true,
      multiplier: 2,
      payout: 200,
    });
    expect(evaluate(["🔔", "🔔", "🔔"], 100)).toMatchObject({
      won: true,
      multiplier: 5,
      payout: 500,
    });
  });

  it("pays nothing when the reels differ", () => {
    expect(evaluate(["🍒", "🍋", "🍒"], 100)).toMatchObject({
      won: false,
      multiplier: 0,
      payout: 0,
    });
  });

  it("loses the stake on a miss — v1 credited a loss with zero change", () => {
    const stake = 100;
    const result = evaluate(["🍒", "🍋", "🔔"], stake);
    expect(result.payout - stake).toBe(-stake);
  });

  it("is negative expected value over the whole outcome space", () => {
    const stake = 100;
    let total = 0;
    let count = 0;

    for (const a of SLOT_SYMBOLS) {
      for (const b of SLOT_SYMBOLS) {
        for (const c of SLOT_SYMBOLS) {
          total += evaluate([a, b, c] as Reels, stake).payout;
          count += 1;
        }
      }
    }

    expect(total / count).toBeLessThan(stake);
  });
});
