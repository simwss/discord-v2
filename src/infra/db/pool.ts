import pg from "pg";
import type { Logger } from "pino";
import { getEnv } from "../../config/env.js";

/**
 * node-postgres hands `bigint` columns back as strings, because a 64-bit
 * integer does not always survive the trip through a JS number. Every bigint
 * column in this schema carries a CHECK constraint keeping it inside the
 * safe-integer range (see `migrations.ts`), so parsing to a number here is
 * lossless and spares every call site a manual conversion.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export type Db = pg.Pool;

function sslOption(mode: "off" | "on" | "no-verify"): pg.PoolConfig {
  switch (mode) {
    case "off":
      return {};
    case "on":
      return { ssl: { rejectUnauthorized: true } };
    case "no-verify":
      return { ssl: { rejectUnauthorized: false } };
  }
}

/**
 * Builds the connection pool. Called once from the composition root; the rest
 * of the app receives the pool by injection rather than importing a
 * module-level singleton.
 */
export function createPool(logger: Logger): Db {
  const { database } = getEnv();

  const pool = new pg.Pool({
    connectionString: database.url,
    max: database.poolMax,
    // Fail fast rather than hanging a slash command until Discord's own
    // interaction timeout expires.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: "rasselbande-bot",
    ...sslOption(database.ssl),
  });

  // An idle client dying (network blip, database restart) emits on the pool.
  // Node terminates the process on an unhandled 'error' event, so this
  // listener is what keeps a database restart from killing the bot.
  pool.on("error", (error) => {
    logger.error({ err: error }, "idle database client error");
  });

  return pool;
}

/** Readiness probe: cheap round trip proving the database is still answering. */
export async function isDatabaseReachable(
  pool: Db,
  logger: Logger,
): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (error) {
    logger.warn({ err: error }, "database health check failed");
    return false;
  }
}
