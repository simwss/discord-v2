import type { PoolClient } from "pg";
import type { Db } from "./pool.js";

/**
 * Runs `work` on a dedicated client inside `BEGIN`/`COMMIT`, releasing the
 * client whichever way it ends.
 *
 * Repositories use this wherever a decision is read and then acted on — a
 * balance check followed by a debit, a "is the vote still open" check followed
 * by a ballot. Combined with `SELECT ... FOR UPDATE` (or the locking upsert in
 * the user repository) it gives the same guarantee the Realtime Database
 * transactions gave: concurrent commands for one user serialise instead of
 * losing each other's writes.
 */
export async function withTransaction<T>(
  pool: Db,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    // A rollback on a broken connection throws in turn; the original failure
    // is the one worth reporting.
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
