import type { AssetKind } from "../../domain/trading.js";

export interface Asset {
  /** Provider symbol, e.g. `AAPL` or `BTC-USD`. */
  readonly symbol: string;
  readonly kind: AssetKind;
  /** Human-readable name, e.g. `Apple Inc.`. */
  readonly name: string;
}

export interface Quote {
  readonly price: number;
  /** Change since the previous close (stocks) or over 24 hours (crypto). */
  readonly changePercent: number | null;
  /** When the quote was fetched. */
  readonly fetchedAt: number;
}
