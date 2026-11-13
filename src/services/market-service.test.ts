import { describe, expect, it, vi } from "vitest";
import { fixedClock } from "../core/clock.js";
import { UserFacingError } from "../core/errors.js";
import type { CoinbaseClient } from "../infra/market/coinbase.js";
import type { FinnhubClient } from "../infra/market/finnhub.js";
import { MarketDataError } from "../infra/market/http.js";
import { MarketService } from "./market-service.js";

function fakeFinnhub(overrides: Partial<FinnhubClient> = {}): FinnhubClient {
  return {
    quote: vi.fn(() => Promise.resolve({ price: 100, changePercent: 1 })),
    search: vi.fn(() =>
      Promise.resolve({ symbol: "AAPL", name: "Apple Inc." }),
    ),
    marketStatus: vi.fn(() =>
      Promise.resolve({ isOpen: true, session: "regular", holiday: null }),
    ),
    remainingCalls: () => 55,
    ...overrides,
  } as unknown as FinnhubClient;
}

function fakeCoinbase(
  stats: CoinbaseClient["stats"] = () =>
    Promise.resolve({ price: 50_000, changePercent: -2 }),
): CoinbaseClient {
  return { stats };
}

describe("MarketService.resolve", () => {
  it("finds a stock by ISIN", async () => {
    const market = new MarketService(
      fakeFinnhub(),
      fakeCoinbase(),
      fixedClock(0),
    );
    await expect(market.resolve("US0378331005")).resolves.toEqual({
      symbol: "AAPL",
      kind: "stock",
      name: "Apple Inc.",
    });
  });

  it("caches lookups", async () => {
    const search = vi.fn(() =>
      Promise.resolve({ symbol: "AAPL", name: "Apple Inc." }),
    );
    const finnhub = fakeFinnhub({ search });
    const market = new MarketService(finnhub, fakeCoinbase(), fixedClock(0));
    await market.resolve("US0378331005");
    await market.resolve("us0378331005");
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("finds crypto without Finnhub", async () => {
    const market = new MarketService(null, fakeCoinbase(), fixedClock(0));
    await expect(market.resolve("btc-usd")).resolves.toMatchObject({
      symbol: "BTC-USD",
      kind: "crypto",
    });
  });

  it("explains that only US stocks work", async () => {
    const finnhub = fakeFinnhub({
      search: () => Promise.resolve({ symbol: "SAP.DE", name: "SAP SE" }),
      quote: () => Promise.reject(new MarketDataError("denied", "forbidden")),
    });
    const market = new MarketService(finnhub, fakeCoinbase(), fixedClock(0));
    await expect(market.resolve("DE0007164600")).rejects.toThrow(/US-Börse/);
  });

  it("rejects unknown tickers and coins", async () => {
    const market = new MarketService(
      fakeFinnhub({ quote: () => Promise.resolve(null) }),
      fakeCoinbase(() => Promise.resolve(null)),
      fixedClock(0),
    );
    await expect(market.resolve("NOPE")).rejects.toThrow(UserFacingError);
    await expect(market.resolve("NOPE-USD")).rejects.toThrow(UserFacingError);
  });

  it("rejects stocks when no Finnhub key is configured", async () => {
    const market = new MarketService(null, fakeCoinbase(), fixedClock(0));
    await expect(market.resolve("AAPL")).rejects.toThrow(/nicht eingerichtet/);
  });

  it("turns provider outages into a friendly error", async () => {
    const market = new MarketService(
      fakeFinnhub({
        search: () =>
          Promise.reject(new MarketDataError("down", "unavailable")),
      }),
      fakeCoinbase(),
      fixedClock(0),
    );
    await expect(market.resolve("US0378331005")).rejects.toThrow(
      /nicht erreichbar/,
    );
  });
});

describe("MarketService.quote", () => {
  it("reuses a fresh price and refetches an old one", async () => {
    let now = 0;
    const quote = vi.fn(() =>
      Promise.resolve({ price: 100, changePercent: 1 }),
    );
    const finnhub = fakeFinnhub({ quote });
    const market = new MarketService(finnhub, fakeCoinbase(), {
      now: () => now,
    });
    const asset = { symbol: "AAPL", kind: "stock", name: "Apple" } as const;

    await market.quote(asset, 5_000);
    now = 4_000;
    await market.quote(asset, 5_000);
    expect(quote).toHaveBeenCalledTimes(1);

    now = 6_000;
    await market.quote(asset, 5_000);
    expect(quote).toHaveBeenCalledTimes(2);
  });
});

describe("MarketService.tradingStatus", () => {
  it("always lets crypto trade", async () => {
    const market = new MarketService(null, fakeCoinbase(), fixedClock(0));
    await expect(
      market.tradingStatus({ symbol: "BTC-USD", kind: "crypto", name: "" }),
    ).resolves.toEqual({ open: true });
  });

  it("blocks stocks while the exchange is closed", async () => {
    const market = new MarketService(
      fakeFinnhub({
        marketStatus: () =>
          Promise.resolve({
            isOpen: false,
            session: null,
            holiday: "Thanksgiving",
          }),
      }),
      fakeCoinbase(),
      fixedClock(0),
    );
    const status = await market.tradingStatus({
      symbol: "AAPL",
      kind: "stock",
      name: "",
    });
    expect(status).toEqual({
      open: false,
      reason: expect.stringContaining("Thanksgiving") as unknown,
    });
  });
});
