import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import { fixedClock } from "../core/clock.js";
import type { Position } from "../domain/trading.js";
import type { PositionRepository } from "../infra/db/position-repository.js";
import { LiquidationJob } from "./liquidation-job.js";
import type { MarketService } from "./market-service.js";

const silent = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

function position(overrides: Partial<Position>): Position {
  return {
    id: 1,
    userId: "u1",
    symbol: "BTC-USD",
    kind: "crypto",
    name: "BTC-USD",
    side: "long",
    leverage: 10,
    margin: 1_000,
    entryPrice: 100,
    openedAt: 0,
    ...overrides,
  };
}

function setup(
  open: Position[],
  prices: Record<string, number>,
  marketOpen = true,
) {
  const liquidate = vi.fn((id: number) =>
    Promise.resolve(open.find((p) => p.id === id) ?? null),
  );
  const positions = {
    allOpen: vi.fn(() => Promise.resolve(open)),
    liquidate,
  } as unknown as PositionRepository;

  const quote = vi.fn((asset: Position) =>
    Promise.resolve({
      price: prices[asset.symbol] ?? 0,
      changePercent: null,
      fetchedAt: 0,
    }),
  );
  const market = {
    quote,
    tradingStatus: vi.fn(() =>
      Promise.resolve(
        marketOpen ? { open: true } : { open: false, reason: "closed" },
      ),
    ),
    stockBudget: () => 55,
  } as unknown as MarketService;

  const notify = vi.fn(() => Promise.resolve());
  const job = new LiquidationJob(
    positions,
    market,
    fixedClock(1_000),
    silent,
    notify,
  );
  return { job, liquidate, quote, notify };
}

describe("LiquidationJob", () => {
  it("liquidates only positions past their liquidation price", async () => {
    const safe = position({ id: 1 });
    const doomed = position({ id: 2, leverage: 100 });
    const { job, liquidate, notify } = setup([safe, doomed], {
      "BTC-USD": 99,
    });

    await job.tick();

    expect(liquidate).toHaveBeenCalledTimes(1);
    expect(liquidate).toHaveBeenCalledWith(2, 99, 1_000);
    expect(notify).toHaveBeenCalledWith(doomed, 99);
  });

  it("prices each symbol once", async () => {
    const { job, quote } = setup(
      [position({ id: 1 }), position({ id: 2, side: "short" })],
      { "BTC-USD": 100 },
    );
    await job.tick();
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("leaves stocks alone while the exchange is closed", async () => {
    const stock = position({ symbol: "AAPL", kind: "stock", leverage: 100 });
    const { job, quote, liquidate } = setup([stock], { AAPL: 1 }, false);
    await job.tick();
    expect(quote).not.toHaveBeenCalled();
    expect(liquidate).not.toHaveBeenCalled();
  });

  it("keeps going when a notification fails", async () => {
    const { job, notify } = setup(
      [position({ id: 1, leverage: 100 }), position({ id: 2, leverage: 100 })],
      { "BTC-USD": 50 },
    );
    notify.mockRejectedValueOnce(new Error("DMs closed"));
    await job.tick();
    expect(notify).toHaveBeenCalledTimes(2);
  });
});
