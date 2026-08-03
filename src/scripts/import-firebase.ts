/**
 * One-shot import of a Firebase Realtime Database export into Postgres.
 *
 * Take the export first — the Firebase console offers one under Realtime
 * Database -> ⋮ -> Export JSON, or, if the database still allows unauthenticated
 * reads:
 *
 *   curl "$FIREBASE_DATABASE_URL/.json?print=pretty" -o firebase-export.json
 *
 * Then, with DATABASE_URL pointing at the new database:
 *
 *   npm run import:firebase -- firebase-export.json
 *
 * Safe to re-run: users are matched by id and their balances overwritten with
 * the values in the export, so a second pass is a no-op unless the file
 * changed. In-progress blackjack hands are deliberately skipped — they are
 * worth nothing once the stake has already been debited, and dropping them
 * just ends those hands.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { getLogger } from "../core/logger.js";
import { toError } from "../core/errors.js";
import { createPool } from "../infra/db/pool.js";
import { runMigrations } from "../infra/db/migrate.js";
import { STARTING_BALANCE } from "../domain/user.js";

/**
 * The v1 record shape. Every field is optional and every value is coerced,
 * because these records were written by an app with no schema: missing keys,
 * strings where numbers belong and negative counts all appear in real data.
 */
const legacyUser = z.object({
  balance: z.number().catch(STARTING_BALANCE).default(STARTING_BALANCE),
  authorised: z.boolean().catch(false).default(false),
  basicMiners: z.number().int().nonnegative().catch(0).default(0),
  eliteMiners: z.number().int().nonnegative().catch(0).default(0),
  deluxeMiners: z.number().int().nonnegative().catch(0).default(0),
  lastMine: z.number().nonnegative().catch(0).default(0),
  hourlyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
  dailyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
  weeklyWorkTimestamp: z.number().nonnegative().catch(0).default(0),
});

const legacyVote = z.object({
  description: z.string().catch("").default(""),
  authorId: z.string().catch("").default(""),
  users: z.record(z.string(), z.boolean()).catch({}).default({}),
  closed: z.boolean().catch(false).default(false),
  createdAt: z.number().nonnegative().catch(0).default(0),
});

const exportSchema = z.object({
  users: z.record(z.string(), z.unknown()).default({}),
  votes: z.record(z.string(), z.unknown()).default({}),
});

/** Clamps to what a bigint column constrained to the safe-integer range takes. */
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function clamp(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), MAX_SAFE);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    throw new Error(
      "Usage: npm run import:firebase -- <firebase-export.json>\n" +
        "See the comment at the top of this script for how to produce the export.",
    );
  }

  const logger = getLogger();
  const parsed = exportSchema.safeParse(
    JSON.parse(await readFile(file, "utf8")),
  );
  if (!parsed.success) {
    throw new Error(
      `${file} does not look like a Realtime Database export: no top-level "users" or "votes" object`,
    );
  }

  const pool = createPool(logger);

  try {
    await runMigrations(pool, logger);

    let users = 0;
    for (const [id, raw] of Object.entries(parsed.data.users)) {
      const user = legacyUser.parse(
        typeof raw === "object" && raw !== null && !Array.isArray(raw)
          ? raw
          : {},
      );

      await pool.query(
        `INSERT INTO users (id, balance, authorised, basic_miners,
                            elite_miners, deluxe_miners, last_mine_at,
                            hourly_work_at, daily_work_at, weekly_work_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           balance        = EXCLUDED.balance,
           authorised     = EXCLUDED.authorised,
           basic_miners   = EXCLUDED.basic_miners,
           elite_miners   = EXCLUDED.elite_miners,
           deluxe_miners  = EXCLUDED.deluxe_miners,
           last_mine_at   = EXCLUDED.last_mine_at,
           hourly_work_at = EXCLUDED.hourly_work_at,
           daily_work_at  = EXCLUDED.daily_work_at,
           weekly_work_at = EXCLUDED.weekly_work_at,
           updated_at     = now()`,
        [
          id,
          clamp(user.balance),
          user.authorised,
          user.basicMiners,
          user.eliteMiners,
          user.deluxeMiners,
          clamp(user.lastMine),
          clamp(user.hourlyWorkTimestamp),
          clamp(user.dailyWorkTimestamp),
          clamp(user.weeklyWorkTimestamp),
        ],
      );
      users += 1;
    }

    let votes = 0;
    let ballots = 0;
    for (const [id, raw] of Object.entries(parsed.data.votes)) {
      const vote = legacyVote.parse(
        typeof raw === "object" && raw !== null && !Array.isArray(raw)
          ? raw
          : {},
      );

      await pool.query(
        `INSERT INTO votes (id, description, author_id, closed, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           description = EXCLUDED.description,
           author_id   = EXCLUDED.author_id,
           closed      = EXCLUDED.closed,
           created_at  = EXCLUDED.created_at`,
        [
          id,
          vote.description,
          vote.authorId,
          vote.closed,
          clamp(vote.createdAt),
        ],
      );
      votes += 1;

      for (const [userId, choice] of Object.entries(vote.users)) {
        await pool.query(
          `INSERT INTO vote_ballots (vote_id, user_id, choice)
           VALUES ($1, $2, $3)
           ON CONFLICT (vote_id, user_id) DO UPDATE
             SET choice = EXCLUDED.choice`,
          [id, userId, choice],
        );
        ballots += 1;
      }
    }

    logger.info({ users, votes, ballots }, "import complete");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${toError(error).message}\n`);
  process.exit(1);
});
