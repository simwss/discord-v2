import type { Rng } from "../core/random.js";

export const DIE_FACES = [1, 2, 3, 4, 5, 6] as const;
export type DieFace = (typeof DIE_FACES)[number];

/** Total returned on a win, including the stake. A 1-in-6 shot pays 6:1. */
export const DICEROLL_PAYOUT_MULTIPLIER = 7;

export function roll(rng: Rng): DieFace {
  return (rng.int(DIE_FACES.length) + 1) as DieFace;
}

export function isDieFace(value: number): value is DieFace {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export interface DicerollResult {
  readonly result: DieFace;
  readonly won: boolean;
  /** Credited back to the player; the stake was already debited. */
  readonly payout: number;
}

export function resolve(
  result: DieFace,
  pick: DieFace,
  stake: number,
): DicerollResult {
  const won = result === pick;
  return {
    result,
    won,
    payout: won ? stake * DICEROLL_PAYOUT_MULTIPLIER : 0,
  };
}
