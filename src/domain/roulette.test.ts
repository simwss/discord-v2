import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import { colorOf, POCKETS, resolve, spin } from "./roulette.js";

describe("colorOf", () => {
  it("calls zero green", () => {
    expect(colorOf(0)).toBe("green");
  });

  it("assigns 18 red and 18 black pockets", () => {
    const pockets = Array.from({ length: POCKETS }, (_, i) => colorOf(i));
    expect(pockets.filter((c) => c === "red")).toHaveLength(18);
    expect(pockets.filter((c) => c === "black")).toHaveLength(18);
    expect(pockets.filter((c) => c === "green")).toHaveLength(1);
  });
});

describe("spin", () => {
  it("stays within the wheel", () => {
    const rng = seededRng(11);
    for (let i = 0; i < 500; i++) {
      const pocket = spin(rng);
      expect(pocket).toBeGreaterThanOrEqual(0);
      expect(pocket).toBeLessThan(POCKETS);
    }
  });

  it("can reach every pocket", () => {
    const rng = seededRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(spin(rng));
    expect(seen.size).toBe(POCKETS);
  });
});

describe("resolve", () => {
  it("pays even money on red", () => {
    // Pocket 1 is red.
    expect(resolve(1, "red", 100)).toMatchObject({ won: true, payout: 200 });
  });

  it("pays 36:1 on green", () => {
    expect(resolve(0, "green", 100)).toMatchObject({ won: true, payout: 3700 });
  });

  it("pays nothing on a miss", () => {
    expect(resolve(1, "black", 100)).toMatchObject({ won: false, payout: 0 });
  });

  it("does not pay a red or black bet when zero comes up", () => {
    expect(resolve(0, "red", 100).payout).toBe(0);
    expect(resolve(0, "black", 100).payout).toBe(0);
  });

  it("keeps the house edge negative for the player on even-money bets", () => {
    const stake = 100;
    const expected =
      Array.from(
        { length: POCKETS },
        (_, i) => resolve(i, "red", stake).payout,
      ).reduce((sum, p) => sum + p, 0) / POCKETS;
    expect(expected).toBeLessThan(stake);
  });
});
