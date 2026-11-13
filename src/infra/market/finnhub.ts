import { z } from "zod";
import { getJson, MarketDataError } from "./http.js";

const BASE_URL = "https://finnhub.io/api/v1";

/** The free plan allows 60 calls a minute; stay a little below it. */
const CALLS_PER_MINUTE = 55;
const WINDOW_MS = 60_000;

const quoteSchema = z.object({
  c: z.number(),
  dp: z.number().nullable(),
});

const searchSchema = z.object({
  result: z.array(
    z.object({
      symbol: z.string(),
      description: z.string(),
      type: z.string(),
    }),
  ),
});

const marketStatusSchema = z.object({
  isOpen: z.boolean(),
  session: z.string().nullable(),
  holiday: z.string().nullable(),
});

export interface MarketStatus {
  readonly isOpen: boolean;
  readonly session: string | null;
  readonly holiday: string | null;
}

/**
 * Finnhub REST client. Counts its own calls so the bot runs out of budget
 * gracefully instead of getting HTTP 429s from Finnhub.
 */
export class FinnhubClient {
  private readonly calls: number[] = [];

  constructor(
    private readonly apiKey: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Calls still available in the current one-minute window. */
  remainingCalls(): number {
    this.forgetOldCalls();
    return CALLS_PER_MINUTE - this.calls.length;
  }

  /** Last price and daily change, or `null` when Finnhub has no price. */
  async quote(
    symbol: string,
  ): Promise<{ price: number; changePercent: number | null } | null> {
    const body = await this.get("/quote", { symbol });
    const parsed = quoteSchema.safeParse(body);
    // Finnhub answers an unknown symbol with all-zero fields, not a 404.
    if (!parsed.success || !(parsed.data.c > 0)) return null;
    return { price: parsed.data.c, changePercent: parsed.data.dp };
  }

  /** Looks up a stock by ISIN or name. Returns the best match or `null`. */
  async search(
    query: string,
  ): Promise<{ symbol: string; name: string } | null> {
    const body = await this.get("/search", { q: query, exchange: "US" });
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) return null;
    const match = parsed.data.result[0];
    return match ? { symbol: match.symbol, name: match.description } : null;
  }

  async marketStatus(): Promise<MarketStatus> {
    const body = await this.get("/stock/market-status", { exchange: "US" });
    const parsed = marketStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new MarketDataError(
        "unexpected Finnhub market status",
        "unavailable",
      );
    }
    return parsed.data;
  }

  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    if (this.remainingCalls() <= 0) {
      throw new MarketDataError("Finnhub call budget used up", "rate_limited");
    }
    this.calls.push(this.now());

    const query = new URLSearchParams({ ...params, token: this.apiKey });
    return getJson(`${BASE_URL}${path}?${query.toString()}`);
  }

  private forgetOldCalls(): void {
    const cutoff = this.now() - WINDOW_MS;
    while (this.calls.length > 0 && (this.calls[0] ?? 0) <= cutoff) {
      this.calls.shift();
    }
  }
}
