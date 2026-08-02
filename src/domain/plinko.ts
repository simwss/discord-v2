import type { Rng } from "../core/random.js";

/** Payout multiplier for each landing slot, left to right. */
export const PLINKO_MULTIPLIERS = [4, 2, 2, 0, 0, 2, 2, 4] as const;

/** Rows the ball falls through. One fewer than the number of slots. */
export const PLINKO_ROWS = PLINKO_MULTIPLIERS.length - 1;

export interface BallPosition {
  /** 0-based row the ball currently occupies. */
  readonly row: number;
  /** 0-based column; increments by one for every rightward bounce. */
  readonly column: number;
}

export interface PlinkoDrop {
  /** Position after each bounce, in order. Length is `PLINKO_ROWS`. */
  readonly path: readonly BallPosition[];
  readonly slot: number;
  readonly multiplier: number;
}

export function drop(rng: Rng): PlinkoDrop {
  const path: BallPosition[] = [];
  let column = 0;

  for (let row = 0; row < PLINKO_ROWS; row++) {
    if (rng.bool()) column += 1;
    path.push({ row, column });
  }

  const slot = column;
  return {
    path,
    slot,
    multiplier: PLINKO_MULTIPLIERS[slot] ?? 0,
  };
}

/** Credited back to the player; the stake was already debited. */
export function payout(multiplier: number, stake: number): number {
  return Math.round(multiplier * stake);
}

const BOARD_WIDTH = PLINKO_MULTIPLIERS.length + 1;

/** Monospaced board with the ball rendered at `position`. */
export function renderBoard(position: BallPosition): string {
  const lines: string[] = [];

  for (let i = 2; i < BOARD_WIDTH; i++) {
    const leftPad = " ".repeat(BOARD_WIDTH - i);
    const rightPad = "  ".repeat(BOARD_WIDTH - i);
    const pegs = Array.from({ length: i }, (_, j) =>
      position.row + 2 === i && j === position.column ? "o  " : ".  ",
    ).join("");
    lines.push(`|   ${leftPad}${pegs}${rightPad}|`);
  }

  lines.push(`|    ${PLINKO_MULTIPLIERS.join("  ")}    |`);
  return lines.join("\n");
}
