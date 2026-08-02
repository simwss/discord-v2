import type { Rng } from "../core/random.js";

export const COIN_SIDES = ["heads", "tails"] as const;
export type CoinSide = (typeof COIN_SIDES)[number];

export const COIN_SIDE_LABELS: Readonly<Record<CoinSide, string>> = {
  heads: "Kopf",
  tails: "Zahl",
};

export function flip(rng: Rng): CoinSide {
  return rng.bool() ? "heads" : "tails";
}

export interface CoinflipResult {
  readonly result: CoinSide;
  readonly won: boolean;
  /** Credited back to the player; the stake was already debited. */
  readonly payout: number;
}

export function resolve(
  result: CoinSide,
  pick: CoinSide,
  stake: number,
): CoinflipResult {
  const won = result === pick;
  return { result, won, payout: won ? stake * 2 : 0 };
}
