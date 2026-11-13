import type { Logger } from "pino";
import type { Clock } from "../core/clock.js";
import { toError } from "../core/errors.js";
import { isLiquidated, type Position } from "../domain/trading.js";
import type { PositionRepository } from "../infra/db/position-repository.js";
import type { MarketService } from "./market-service.js";

const INTERVAL_MS = 60_000;

/**
 * Finnhub calls the job leaves for players each minute. With more stocks
 * open than the rest of the budget covers, the job works through them over
 * several minutes instead of starving /long and /short.
 */
const PLAYER_RESERVE = 20;

const QUOTE_MAX_AGE_MS = 15_000;

export type LiquidationNotifier = (
  position: Position,
  price: number,
) => Promise<void>;

/**
 * Every minute, prices every asset someone holds and liquidates positions
 * that have lost 90% of their stake. Stocks are skipped while the US market
 * is closed, because their price cannot move then.
 */
export class LiquidationJob {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** Rotates which stocks are checked first when the budget runs short. */
  private cursor = 0;

  constructor(
    private readonly positions: PositionRepository,
    private readonly market: MarketService,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly notify: LiquidationNotifier,
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, INTERVAL_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  /** One pass over all open positions. Never throws. */
  async tick(): Promise<void> {
    // A slow provider must not make passes pile up on top of each other.
    if (this.running) return;
    this.running = true;
    try {
      await this.checkAll();
    } catch (error) {
      this.logger.error({ err: toError(error) }, "liquidation pass failed");
    } finally {
      this.running = false;
    }
  }

  private async checkAll(): Promise<void> {
    const open = await this.positions.allOpen();
    if (open.length === 0) return;

    const bySymbol = new Map<string, Position[]>();
    for (const position of open) {
      const list = bySymbol.get(position.symbol) ?? [];
      list.push(position);
      bySymbol.set(position.symbol, list);
    }

    const groups = [...bySymbol.values()];
    const crypto = groups.filter((g) => g[0]?.kind === "crypto");
    const stocks = groups.filter((g) => g[0]?.kind === "stock");

    for (const group of crypto) await this.checkSymbol(group);

    if (stocks.length === 0 || !(await this.stockMarketOpen(stocks))) return;

    const start = this.cursor % stocks.length;
    const ordered = [...stocks.slice(start), ...stocks.slice(0, start)];
    let checked = 0;
    for (const group of ordered) {
      if (this.market.stockBudget() <= PLAYER_RESERVE) break;
      await this.checkSymbol(group);
      checked += 1;
    }
    this.cursor = start + checked;

    if (checked < stocks.length) {
      this.logger.info(
        { checked, total: stocks.length },
        "finnhub budget short; remaining stocks checked next pass",
      );
    }
  }

  private async stockMarketOpen(stocks: Position[][]): Promise<boolean> {
    const sample = stocks[0]?.[0];
    if (!sample) return false;
    try {
      return (await this.market.tradingStatus(sample)).open;
    } catch (error) {
      this.logger.warn({ err: toError(error) }, "could not read market status");
      return false;
    }
  }

  private async checkSymbol(group: Position[]): Promise<void> {
    const first = group[0];
    if (!first) return;

    let price: number;
    try {
      price = (await this.market.quote(first, QUOTE_MAX_AGE_MS)).price;
    } catch (error) {
      this.logger.warn(
        { err: toError(error), symbol: first.symbol },
        "could not price symbol for liquidation",
      );
      return;
    }

    for (const position of group) {
      if (!isLiquidated(position, price)) continue;

      const liquidated = await this.positions.liquidate(
        position.id,
        price,
        this.clock.now(),
      );
      if (!liquidated) continue;

      this.logger.info(
        { positionId: position.id, userId: position.userId, price },
        "position liquidated",
      );
      try {
        await this.notify(liquidated, price);
      } catch (error) {
        // Closed DMs are common; the player still sees it in /portfolio.
        this.logger.debug(
          { err: toError(error), userId: position.userId },
          "could not send liquidation notice",
        );
      }
    }
  }
}
