import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import { COIN_SIDES, flip, resolve } from "./coinflip.js";
import {
  DICEROLL_PAYOUT_MULTIPLIER,
  isDieFace,
  resolve as resolveDice,
  roll,
} from "./diceroll.js";

describe("coinflip", () => {
  it("only ever returns a real side", () => {
    const rng = seededRng(3);
    for (let i = 0; i < 200; i++) {
      expect(COIN_SIDES).toContain(flip(rng));
    }
  });

  it("produces both sides", () => {
    const rng = seededRng(3);
    const seen = new Set(Array.from({ length: 200 }, () => flip(rng)));
    expect(seen.size).toBe(2);
  });

  it("doubles the stake on a correct call", () => {
    expect(resolve("heads", "heads", 100)).toMatchObject({
      won: true,
      payout: 200,
    });
  });

  it("pays nothing on a wrong call", () => {
    expect(resolve("heads", "tails", 100)).toMatchObject({
      won: false,
      payout: 0,
    });
  });
});

describe("diceroll", () => {
  it("rolls within 1..6", () => {
    const rng = seededRng(8);
    for (let i = 0; i < 500; i++) {
      const value = roll(rng);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it("can roll every face", () => {
    const rng = seededRng(8);
    const seen = new Set(Array.from({ length: 2000 }, () => roll(rng)));
    expect(seen.size).toBe(6);
  });

  it("pays seven times the stake on a hit, a net win of six", () => {
    const result = resolveDice(4, 4, 100);
    expect(result.payout).toBe(100 * DICEROLL_PAYOUT_MULTIPLIER);
    expect(result.payout - 100).toBe(600);
  });

  it("pays nothing on a miss", () => {
    expect(resolveDice(4, 5, 100).payout).toBe(0);
  });

  it("validates die faces", () => {
    expect(isDieFace(1)).toBe(true);
    expect(isDieFace(6)).toBe(true);
    expect(isDieFace(0)).toBe(false);
    expect(isDieFace(7)).toBe(false);
    expect(isDieFace(2.5)).toBe(false);
  });
});
