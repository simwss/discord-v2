import { UserFacingError } from "../core/errors.js";
import type { Clock } from "../core/clock.js";
import { parseAssetInput } from "../domain/asset-input.js";
import type { CoinbaseClient } from "../infra/market/coinbase.js";
import type { FinnhubClient, MarketStatus } from "../infra/market/finnhub.js";
import { MarketDataError } from "../infra/market/http.js";
import type { Asset, Quote } from "../infra/market/types.js";

const MARKET_STATUS_TTL_MS = 60_000;

/** Trades use a price at most this old; anything older is fetched again. */
export const TRADE_QUOTE_MAX_AGE_MS = 5_000;
/** Price lists and portfolios may show slightly older prices. */
export const DISPLAY_QUOTE_MAX_AGE_MS = 30_000;

export type TradingStatus =
  { readonly open: true } | { readonly open: false; readonly reason: string };

/**
 * Turns what a player typed into a tradable asset and fetches its price.
 *
 * Stocks come from Finnhub (US exchanges only on the free plan), crypto pairs
 * from Coinbase. Both are cached briefly so a burst of commands does not burn
 * through Finnhub's 60-calls-a-minute allowance.
 */
export class MarketService {
  private readonly assets = new Map<string, Asset>();
  private readonly quotes = new Map<string, Quote>();
  private status: { value: MarketStatus; fetchedAt: number } | undefined;

  constructor(
    private readonly finnhub: FinnhubClient | null,
    private readonly coinbase: CoinbaseClient,
    private readonly clock: Clock,
  ) {}

  /** @throws {UserFacingError} when the asset is unknown or unsupported. */
  async resolve(raw: string): Promise<Asset> {
    const input = parseAssetInput(raw);
    if (!input) {
      throw new UserFacingError(
        "Gib eine ISIN (z.B. US0378331005), ein US-Kürzel (z.B. AAPL) oder ein Krypto-Paar (z.B. BTC-USD) an.",
      );
    }

    const key = input.type === "isin" ? input.isin : input.symbol;
    const cached = this.assets.get(key);
    if (cached) return cached;

    const asset = await friendlyErrors(() => this.lookUp(input));
    this.assets.set(key, asset);
    this.assets.set(asset.symbol, asset);
    return asset;
  }

  /** Current price, from cache when it is younger than `maxAgeMs`. */
  async quote(asset: Asset, maxAgeMs: number): Promise<Quote> {
    const cached = this.quotes.get(asset.symbol);
    const now = this.clock.now();
    if (cached && now - cached.fetchedAt <= maxAgeMs) return cached;

    const fresh = await friendlyErrors(() => this.fetchPrice(asset));
    if (!fresh) {
      throw new UserFacingError(
        `Für ${asset.symbol} gibt es gerade keinen Kurs.`,
      );
    }

    const quote: Quote = { ...fresh, fetchedAt: now };
    this.quotes.set(asset.symbol, quote);
    return quote;
  }

  /** Whether `asset` can be bought or sold right now. */
  async tradingStatus(asset: Asset): Promise<TradingStatus> {
    if (asset.kind === "crypto") return { open: true };

    const status = await friendlyErrors(() => this.marketStatus());
    if (status.isOpen) return { open: true };

    const reason = status.holiday
      ? `Die US-Börse ist heute geschlossen (${status.holiday}).`
      : "Die US-Börse ist gerade geschlossen. Aktien kannst du Mo–Fr von 15:30 bis 22:00 Uhr (deutsche Zeit) handeln.";
    return { open: false, reason };
  }

  /** Finnhub calls left this minute; zero when stocks are disabled. */
  stockBudget(): number {
    return this.finnhub?.remainingCalls() ?? 0;
  }

  private async lookUp(
    input: NonNullable<ReturnType<typeof parseAssetInput>>,
  ): Promise<Asset> {
    if (input.type === "crypto") {
      const stats = await this.coinbase.stats(input.symbol);
      if (!stats) {
        throw new UserFacingError(
          `${input.symbol} gibt es bei Coinbase nicht.`,
        );
      }
      this.remember(input.symbol, stats);
      return { symbol: input.symbol, kind: "crypto", name: input.symbol };
    }

    const finnhub = this.requireFinnhub();

    if (input.type === "isin") {
      const match = await finnhub.search(input.isin);
      if (!match) {
        throw new UserFacingError(
          `Zur ISIN ${input.isin} habe ich kein Wertpapier gefunden.`,
        );
      }
      await this.validateStock(finnhub, match.symbol);
      return { symbol: match.symbol, kind: "stock", name: match.name };
    }

    await this.validateStock(finnhub, input.symbol);
    const match = await finnhub.search(input.symbol);
    const name = match?.symbol === input.symbol ? match.name : input.symbol;
    return { symbol: input.symbol, kind: "stock", name };
  }

  private async validateStock(
    finnhub: FinnhubClient,
    symbol: string,
  ): Promise<void> {
    let quote;
    try {
      quote = await finnhub.quote(symbol);
    } catch (error) {
      if (error instanceof MarketDataError && error.reason === "forbidden") {
        throw new UserFacingError(
          `${symbol} wird nicht an einer US-Börse gehandelt. Es gehen nur US-Aktien und -ETFs.`,
        );
      }
      throw error;
    }
    if (!quote) {
      throw new UserFacingError(
        `Zu ${symbol} habe ich keinen Kurs gefunden. Für Krypto nutze z.B. BTC-USD.`,
      );
    }
    this.remember(symbol, quote);
  }

  private async fetchPrice(
    asset: Asset,
  ): Promise<{ price: number; changePercent: number | null } | null> {
    if (asset.kind === "crypto") return this.coinbase.stats(asset.symbol);
    return this.requireFinnhub().quote(asset.symbol);
  }

  private async marketStatus(): Promise<MarketStatus> {
    const now = this.clock.now();
    if (this.status && now - this.status.fetchedAt < MARKET_STATUS_TTL_MS) {
      return this.status.value;
    }
    const value = await this.requireFinnhub().marketStatus();
    this.status = { value, fetchedAt: now };
    return value;
  }

  private remember(
    symbol: string,
    price: { price: number; changePercent: number | null },
  ): void {
    this.quotes.set(symbol, { ...price, fetchedAt: this.clock.now() });
  }

  private requireFinnhub(): FinnhubClient {
    if (!this.finnhub) {
      throw new UserFacingError(
        "Der Aktienhandel ist auf diesem Bot nicht eingerichtet. Krypto (z.B. BTC-USD) geht trotzdem.",
      );
    }
    return this.finnhub;
  }
}

/** Turns provider failures into messages a player can act on. */
async function friendlyErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof MarketDataError)) throw error;
    if (error.reason === "rate_limited") {
      throw new UserFacingError(
        "Gerade gibt es zu viele Kursabfragen. Versuch es in einer Minute nochmal.",
      );
    }
    throw new UserFacingError(
      "Der Kursanbieter ist gerade nicht erreichbar. Versuch es gleich nochmal.",
    );
  }
}
