import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import {
  drop,
  payout,
  PLINKO_MULTIPLIERS,
  PLINKO_ROWS,
  renderBoard,
} from "./plinko.js";

describe("drop", () => {
  it("records one position per row", () => {
    const result = drop(seededRng(9));
    expect(result.path).toHaveLength(PLINKO_ROWS);
    expect(result.path.map((p) => p.row)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("only ever moves right by one", () => {
    const result = drop(seededRng(31));
    let previous = 0;
    for (const position of result.path) {
      expect(position.column - previous).toBeGreaterThanOrEqual(0);
      expect(position.column - previous).toBeLessThanOrEqual(1);
      previous = position.column;
    }
  });

  it("always lands in a real slot", () => {
    const rng = seededRng(4);
    for (let i = 0; i < 1000; i++) {
      const result = drop(rng);
      expect(result.slot).toBeGreaterThanOrEqual(0);
      expect(result.slot).toBeLessThan(PLINKO_MULTIPLIERS.length);
      expect(result.multiplier).toBe(PLINKO_MULTIPLIERS[result.slot]);
    }
  });

  it("can reach both edges", () => {
    const rng = seededRng(17);
    const slots = new Set<number>();
    for (let i = 0; i < 20000; i++) slots.add(drop(rng).slot);
    expect(slots.has(0)).toBe(true);
    expect(slots.has(PLINKO_MULTIPLIERS.length - 1)).toBe(true);
  });
});

describe("payout", () => {
  it("multiplies the stake", () => {
    expect(payout(4, 250)).toBe(1000);
    expect(payout(0, 250)).toBe(0);
  });
});

describe("renderBoard", () => {
  it("draws one row per drop plus the multiplier legend", () => {
    const lines = renderBoard({ row: 0, column: 0 }).split("\n");
    expect(lines).toHaveLength(PLINKO_ROWS + 1);
    expect(lines.at(-1)).toContain(PLINKO_MULTIPLIERS.join("  "));
  });

  it("marks the ball position", () => {
    const board = renderBoard({ row: 2, column: 1 });
    expect(board).toContain("o");
    const rowWithBall = board.split("\n")[2];
    expect(rowWithBall).toContain("o");
  });

  it("keeps every row the same width so the board does not wobble", () => {
    const widths = new Set(
      renderBoard({ row: 3, column: 2 })
        .split("\n")
        .map((line) => line.length),
    );
    expect(widths.size).toBe(1);
  });
});
