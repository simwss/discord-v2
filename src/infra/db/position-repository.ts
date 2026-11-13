import type { PoolClient } from "pg";
import type { Db } from "./pool.js";
import { withTransaction } from "./transaction.js";
import { lockUser } from "./user-repository.js";
import {
  settlePosition,
  type AssetKind,
  type Position,
  type PositionSide,
  type Settlement,
} from "../../domain/trading.js";

interface PositionRow {
  id: number;
  user_id: string;
  symbol: string;
  kind: AssetKind;
  name: string;
  side: PositionSide;
  leverage: number;
  margin: number;
  entry_price: number;
  opened_at: number;
  status: "open" | "closed" | "liquidated";
  exit_price: number | null;
  payout: number | null;
  closed_at: number | null;
}

export interface ClosedPosition extends Position {
  readonly status: "closed" | "liquidated";
  readonly exitPrice: number;
  readonly payout: number;
  readonly closedAt: number;
}

export type OpenPositionResult =
  | { readonly ok: true; readonly position: Position; readonly balance: number }
  | {
      readonly ok: false;
      readonly reason: "insufficient_funds" | "too_many_positions";
    };

export type ClosePositionResult =
  | {
      readonly ok: true;
      readonly position: Position;
      readonly settlement: Settlement;
      readonly balance: number;
    }
  | { readonly ok: false; readonly reason: "not_found" };

function rowToPosition(row: PositionRow): Position {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    kind: row.kind,
    name: row.name,
    side: row.side,
    leverage: row.leverage,
    margin: row.margin,
    entryPrice: row.entry_price,
    openedAt: row.opened_at,
  };
}

function rowToClosed(row: PositionRow): ClosedPosition {
  return {
    ...rowToPosition(row),
    status: row.status === "liquidated" ? "liquidated" : "closed",
    exitPrice: row.exit_price ?? 0,
    payout: row.payout ?? 0,
    closedAt: row.closed_at ?? 0,
  };
}

/**
 * Leveraged positions. Opening and closing lock the user row like every other
 * balance change, so the stake cannot be spent twice and a position cannot be
 * paid out twice.
 */
export class PositionRepository {
  constructor(private readonly pool: Db) {}

  /** Debits stake and fee and records the position, all or nothing. */
  async open(params: {
    userId: string;
    symbol: string;
    kind: AssetKind;
    name: string;
    side: PositionSide;
    leverage: number;
    margin: number;
    fee: number;
    entryPrice: number;
    now: number;
    maxOpen: number;
  }): Promise<OpenPositionResult> {
    return withTransaction(this.pool, async (client) => {
      const user = await lockUser(client, params.userId);

      const { rows: countRows } = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM positions WHERE user_id = $1 AND status = 'open'",
        [params.userId],
      );
      if ((countRows[0]?.count ?? 0) >= params.maxOpen) {
        return { ok: false, reason: "too_many_positions" };
      }

      const cost = params.margin + params.fee;
      if (user.balance < cost) {
        return { ok: false, reason: "insufficient_funds" };
      }

      const balance = user.balance - cost;
      await client.query(
        "UPDATE users SET balance = $2, updated_at = now() WHERE id = $1",
        [params.userId, balance],
      );

      const { rows } = await client.query<PositionRow>(
        `INSERT INTO positions
           (user_id, symbol, kind, name, side, leverage, margin, entry_price, opened_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          params.userId,
          params.symbol,
          params.kind,
          params.name,
          params.side,
          params.leverage,
          params.margin,
          params.entryPrice,
          params.now,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("Insert of position returned no row");

      return { ok: true, position: rowToPosition(row), balance };
    });
  }

  /** Closes one of the user's own open positions at `price` and pays out. */
  async close(params: {
    userId: string;
    positionId: number;
    price: number;
    now: number;
  }): Promise<ClosePositionResult> {
    return withTransaction(this.pool, async (client) => {
      // User first, then position: the same order as `open`, so the two
      // cannot deadlock each other.
      const user = await lockUser(client, params.userId);
      const row = await lockOpenPosition(client, params.positionId);
      if (row?.user_id !== params.userId) {
        return { ok: false, reason: "not_found" };
      }

      const position = rowToPosition(row);
      const settlement = settlePosition(position, params.price);
      // The database refuses balances it cannot hand back exactly.
      const balance = Math.min(
        user.balance + settlement.payout,
        Number.MAX_SAFE_INTEGER,
      );
      const payout = balance - user.balance;

      await client.query(
        "UPDATE users SET balance = $2, updated_at = now() WHERE id = $1",
        [params.userId, balance],
      );
      await finish(
        client,
        row.id,
        settlement.outcome,
        params.price,
        payout,
        params.now,
      );

      return {
        ok: true,
        position,
        settlement: { ...settlement, payout },
        balance,
      };
    });
  }

  /**
   * Liquidates a position if it is still open and still past its
   * liquidation price. Nothing is paid out, so the user row is not touched.
   * Returns the position when it was liquidated by this call.
   */
  async liquidate(
    positionId: number,
    price: number,
    now: number,
  ): Promise<Position | null> {
    return withTransaction(this.pool, async (client) => {
      const row = await lockOpenPosition(client, positionId);
      if (!row) return null;

      const position = rowToPosition(row);
      if (settlePosition(position, price).outcome !== "liquidated") return null;

      await finish(client, row.id, "liquidated", price, 0, now);
      return position;
    });
  }

  async listOpen(userId: string): Promise<Position[]> {
    const { rows } = await this.pool.query<PositionRow>(
      "SELECT * FROM positions WHERE user_id = $1 AND status = 'open' ORDER BY id",
      [userId],
    );
    return rows.map(rowToPosition);
  }

  async recentClosed(userId: string, limit: number): Promise<ClosedPosition[]> {
    const { rows } = await this.pool.query<PositionRow>(
      `SELECT * FROM positions
       WHERE user_id = $1 AND status <> 'open'
       ORDER BY closed_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map(rowToClosed);
  }

  /** Every open position, for the liquidation job. */
  async allOpen(): Promise<Position[]> {
    const { rows } = await this.pool.query<PositionRow>(
      "SELECT * FROM positions WHERE status = 'open' ORDER BY id",
    );
    return rows.map(rowToPosition);
  }
}

async function lockOpenPosition(
  client: PoolClient,
  positionId: number,
): Promise<PositionRow | undefined> {
  const { rows } = await client.query<PositionRow>(
    "SELECT * FROM positions WHERE id = $1 AND status = 'open' FOR UPDATE",
    [positionId],
  );
  return rows[0];
}

async function finish(
  client: PoolClient,
  positionId: number,
  status: "closed" | "liquidated",
  price: number,
  payout: number,
  now: number,
): Promise<void> {
  await client.query(
    `UPDATE positions
     SET status = $2, exit_price = $3, payout = $4, closed_at = $5
     WHERE id = $1`,
    [positionId, status, price, payout, now],
  );
}
