/**
 * What a player typed to name an asset. Trade Republic and most brokers show
 * an ISIN, so that works alongside plain US tickers and Coinbase crypto pairs.
 */
export type AssetInput =
  | { readonly type: "isin"; readonly isin: string }
  | { readonly type: "ticker"; readonly symbol: string }
  | { readonly type: "crypto"; readonly symbol: string };

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const CRYPTO = /^[A-Z0-9]{2,10}-USD$/;
const TICKER = /^[A-Z][A-Z0-9.]{0,9}$/;

/** Returns `null` when the text cannot be any kind of asset. */
export function parseAssetInput(raw: string): AssetInput | null {
  const text = raw.trim().toUpperCase();
  if (ISIN.test(text)) return { type: "isin", isin: text };
  if (CRYPTO.test(text)) return { type: "crypto", symbol: text };
  if (TICKER.test(text)) return { type: "ticker", symbol: text };
  return null;
}
