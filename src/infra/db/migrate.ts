import type { Logger } from "pino";
import type { Db } from "./pool.js";
import { MIGRATIONS } from "./migrations.js";

/**
 * Arbitrary but fixed: every instance that might migrate must agree on it.
 * Held for the duration of the migration transaction, so two containers
 * starting at the same moment cannot apply the same migration twice.
 */
const MIGRATION_LOCK_KEY = 4_711_081_542;

/**
 * Brings the schema up to date, then returns. Running this at boot rather
 * than as a separate deploy step means a fresh `docker compose up` works with
 * no manual setup, and the bot can never talk to a schema it predates.
 *
 * Everything happens in one transaction: Postgres makes DDL transactional, so
 * a failure part-way through leaves the database exactly as it was.
 */
export async function runMigrations(pool: Db, logger: Logger): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         integer PRIMARY KEY,
        name       text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ id: number }>(
      "SELECT id FROM schema_migrations",
    );
    const applied = new Set(rows.map((row) => row.id));

    let count = 0;
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;

      logger.info(
        { id: migration.id, name: migration.name },
        "applying migration",
      );
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (id, name) VALUES ($1, $2)",
        [migration.id, migration.name],
      );
      count += 1;
    }

    await client.query("COMMIT");
    logger.info(
      { applied: count, total: MIGRATIONS.length },
      count === 0 ? "schema already up to date" : "migrations applied",
    );
  } catch (error) {
    // A rollback on a broken connection throws in turn; the original failure
    // is the one worth reporting.
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
