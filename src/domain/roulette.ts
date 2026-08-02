import type { Rng } from "../core/random.js";

export const ROULETTE_COLORS = ["red", "black", "green"] as const;
export type RouletteColor = (typeof ROULETTE_COLORS)[number];

export const POCKETS = 37; // 0-36, European single-zero wheel

const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS: ReadonlySet<number> = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export function colorOf(pocket: number): RouletteColor {
  if (RED_NUMBERS.has(pocket)) return "red";
  if (BLACK_NUMBERS.has(pocket)) return "black";
  return "green";
}

export function spin(rng: Rng): number {
  return rng.int(POCKETS);
}

/**
 * Total returned to the player on a win, including the stake. Red/black are
 * even money; green (the single zero) pays 36:1.
 */
export function payoutMultiplier(color: RouletteColor): number {
  return color === "green" ? 37 : 2;
}

export interface RouletteResult {
  readonly pocket: number;
  readonly color: RouletteColor;
  readonly won: boolean;
  /** Credited back to the player; the stake was already debited. */
  readonly payout: number;
}

export function resolve(
  pocket: number,
  betColor: RouletteColor,
  stake: number,
): RouletteResult {
  const color = colorOf(pocket);
  const won = color === betColor;
  return {
    pocket,
    color,
    won,
    payout: won ? stake * payoutMultiplier(color) : 0,
  };
}
