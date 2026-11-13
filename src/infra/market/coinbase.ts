import { z } from "zod";
import { getJson, MarketDataError } from "./http.js";

const BASE_URL = "https://api.exchange.coinbase.com";

const statsSchema = z.object({
  open: z.coerce.number(),
  last: z.coerce.number(),
});

/** Public Coinbase Exchange data: no key, crypto trades around the clock. */
export class CoinbaseClient {
  /** Last price and 24-hour change, or `null` for an unknown pair. */
  async stats(
    symbol: string,
  ): Promise<{ price: number; changePercent: number | null } | null> {
    const body = await getJson(
      `${BASE_URL}/products/${encodeURIComponent(symbol)}/stats`,
    );
    if (body === null) return null;

    const parsed = statsSchema.safeParse(body);
    if (!parsed.success || !(parsed.data.last > 0)) {
      throw new MarketDataError(
        `unexpected Coinbase response for ${symbol}`,
        "unavailable",
      );
    }

    const { open, last } = parsed.data;
    return {
      price: last,
      changePercent: open > 0 ? ((last - open) / open) * 100 : null,
    };
  }
}
