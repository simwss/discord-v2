import { GameRuleError } from "../core/errors.js";
import { MAX_STAKE } from "./economy.js";

export const MIN_LEVERAGE = 1;
export const MAX_LEVERAGE = 100;

/** Charged on opening and again on closing, as a share of the position size. */
export const TRADING_FEE_RATE = 0.0005;

/**
 * A position is liquidated once it has lost this share of its stake. The
 * remaining tenth absorbs prices that jump past the liquidation point between
 * two checks, so a player can never lose more than the stake.
 */
export const LIQUIDATION_LOSS_RATIO = 0.9;

export const MAX_OPEN_POSITIONS = 10;

/** Penny stocks have unreliable quotes, which is dangerous at 100x. */
export const MIN_ENTRY_PRICE = 1;

export type PositionSide = "long" | "short";
export type AssetKind = "stock" | "crypto";

export interface Position {
  readonly id: number;
  readonly userId: string;
  readonly symbol: string;
  readonly kind: AssetKind;
  readonly name: string;
  readonly side: PositionSide;
  readonly leverage: number;
  /** Money the player put in, already taken from their balance. */
  readonly margin: number;
  readonly entryPrice: number;
  readonly openedAt: number;
}

export interface Settlement {
  readonly outcome: "closed" | "liquidated";
  /** Gain or loss before the closing fee. */
  readonly pnl: number;
  readonly fee: number;
  /** What goes back to the player's balance. */
  readonly payout: number;
}

type PositionTerms = Pick<
  Position,
  "side" | "leverage" | "margin" | "entryPrice"
>;

/** Throws a user-facing error when the order cannot be placed. */
export function assertValidOrder(margin: number, leverage: number): void {
  if (!Number.isSafeInteger(margin) || margin < 1) {
    throw new GameRuleError("Der Einsatz muss mindestens 1$ sein.");
  }
  if (margin > MAX_STAKE) {
    throw new GameRuleError(
      `Der Einsatz darf höchstens ${MAX_STAKE.toLocaleString("de-DE")}$ betragen.`,
    );
  }
  if (
    !Number.isInteger(leverage) ||
    leverage < MIN_LEVERAGE ||
    leverage > MAX_LEVERAGE
  ) {
    throw new GameRuleError(
      `Der Hebel muss zwischen ${MIN_LEVERAGE} und ${MAX_LEVERAGE} liegen.`,
    );
  }
}

/** Fee for opening or closing; at least 1$ so tiny trades are not free. */
export function tradingFee(margin: number, leverage: number): number {
  return Math.max(1, Math.ceil(margin * leverage * TRADING_FEE_RATE));
}

/** Gain (positive) or loss (negative) at `price`, rounded in the bank's favour. */
export function profitAndLoss(position: PositionTerms, price: number): number {
  const direction = position.side === "long" ? 1 : -1;
  const change = (price - position.entryPrice) / position.entryPrice;
  return Math.floor(position.margin * position.leverage * change * direction);
}

/** The price at which the position has lost LIQUIDATION_LOSS_RATIO of its stake. */
export function liquidationPrice(position: PositionTerms): number {
  const move = LIQUIDATION_LOSS_RATIO / position.leverage;
  return position.side === "long"
    ? position.entryPrice * (1 - move)
    : position.entryPrice * (1 + move);
}

export function isLiquidated(position: PositionTerms, price: number): boolean {
  const limit = liquidationPrice(position);
  return position.side === "long" ? price <= limit : price >= limit;
}

/**
 * Closes the position at `price`. A position already past its liquidation
 * price is liquidated instead, even when the player closes it themselves, so
 * a price gap cannot be used to escape a liquidation.
 */
export function settlePosition(
  position: PositionTerms,
  price: number,
): Settlement {
  if (isLiquidated(position, price)) {
    return {
      outcome: "liquidated",
      pnl: -position.margin,
      fee: 0,
      payout: 0,
    };
  }

  const pnl = profitAndLoss(position, price);
  const fee = tradingFee(position.margin, position.leverage);
  return {
    outcome: "closed",
    pnl,
    fee,
    payout: Math.max(0, position.margin + pnl - fee),
  };
}
