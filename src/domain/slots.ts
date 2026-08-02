import type { Rng } from "../core/random.js";

export const SLOT_SYMBOLS = ["🍒", "🍋", "🔔"] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export const REEL_COUNT = 3;

/** Multiplier applied to the stake when all reels match. */
const PAYOUTS: Readonly<Record<SlotSymbol, number>> = {
  "🍒": 2,
  "🍋": 3,
  "🔔": 5,
};

export type Reels = readonly [SlotSymbol, SlotSymbol, SlotSymbol];

export function spin(rng: Rng): Reels {
  return [
    rng.pick(SLOT_SYMBOLS),
    rng.pick(SLOT_SYMBOLS),
    rng.pick(SLOT_SYMBOLS),
  ];
}

export interface SlotResult {
  readonly reels: Reels;
  readonly won: boolean;
  readonly multiplier: number;
  /** Credited back to the player; the stake was already debited. */
  readonly payout: number;
}

export function evaluate(reels: Reels, stake: number): SlotResult {
  const [first] = reels;
  const won = reels.every((symbol) => symbol === first);
  const multiplier = won ? PAYOUTS[first] : 0;
  return { reels, won, multiplier, payout: stake * multiplier };
}
