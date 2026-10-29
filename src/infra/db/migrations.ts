/**
 * Schema history. Migrations are embedded as strings rather than shipped as
 * `.sql` files so that `tsc` alone produces a runnable `dist/` — no asset
 * copying in the build, and nothing to forget in the Dockerfile.
 *
 * Append only: an applied migration is never edited, because the recorded
 * `id` is what stops it running twice.
 */
export interface Migration {
  readonly id: number;
  readonly name: string;
  readonly sql: string;
}

/**
 * The largest integer a JS number represents exactly. Balances and epoch
 * timestamps are `bigint` in Postgres but must round-trip through `number` in
 * the application, so the database refuses values it could not hand back
 * faithfully. See the INT8 type parser in `pool.ts`.
 */
const MAX_SAFE = "9007199254740991";

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "initial schema",
    sql: `
      CREATE TABLE users (
        id             text PRIMARY KEY,
        balance        bigint  NOT NULL DEFAULT 1000
                         CHECK (balance >= 0 AND balance <= ${MAX_SAFE}),
        authorised     boolean NOT NULL DEFAULT false,
        basic_miners   integer NOT NULL DEFAULT 0 CHECK (basic_miners  >= 0),
        elite_miners   integer NOT NULL DEFAULT 0 CHECK (elite_miners  >= 0),
        deluxe_miners  integer NOT NULL DEFAULT 0 CHECK (deluxe_miners >= 0),
        last_mine_at   bigint  NOT NULL DEFAULT 0
                         CHECK (last_mine_at   BETWEEN 0 AND ${MAX_SAFE}),
        hourly_work_at bigint  NOT NULL DEFAULT 0
                         CHECK (hourly_work_at BETWEEN 0 AND ${MAX_SAFE}),
        daily_work_at  bigint  NOT NULL DEFAULT 0
                         CHECK (daily_work_at  BETWEEN 0 AND ${MAX_SAFE}),
        weekly_work_at bigint  NOT NULL DEFAULT 0
                         CHECK (weekly_work_at BETWEEN 0 AND ${MAX_SAFE}),
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now()
      );

      -- /leaderboard reads the richest handful on every invocation.
      CREATE INDEX users_balance_idx ON users (balance DESC);

      CREATE TABLE votes (
        id          text PRIMARY KEY,
        description text    NOT NULL,
        author_id   text    NOT NULL DEFAULT '',
        closed      boolean NOT NULL DEFAULT false,
        created_at  bigint  NOT NULL DEFAULT 0
                      CHECK (created_at BETWEEN 0 AND ${MAX_SAFE})
      );

      -- One row per ballot, where v1 kept a single JSON map on the vote. Two
      -- people voting in the same instant now touch different rows instead of
      -- racing to rewrite the same blob.
      CREATE TABLE vote_ballots (
        vote_id text        NOT NULL REFERENCES votes (id) ON DELETE CASCADE,
        user_id text        NOT NULL,
        choice  boolean     NOT NULL,
        cast_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (vote_id, user_id)
      );

      -- A hand in progress. The stake is already debited from the balance, so
      -- the row is the record of money owed back to the player.
      CREATE TABLE blackjack_games (
        user_id    text   PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        stake      bigint NOT NULL CHECK (stake > 0 AND stake <= ${MAX_SAFE}),
        deck       jsonb  NOT NULL,
        dealer     jsonb  NOT NULL,
        player     jsonb  NOT NULL,
        status     text   NOT NULL CHECK (status IN ('playing', 'finished')),
        outcome    text   CHECK (outcome IN ('natural', 'won', 'push', 'lost')),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: 2,
    name: "streaks, robbing and achievements",
    sql: `
      ALTER TABLE users
        ADD COLUMN daily_streak integer NOT NULL DEFAULT 0
          CHECK (daily_streak >= 0),
        ADD COLUMN blackjack_win_streak integer NOT NULL DEFAULT 0
          CHECK (blackjack_win_streak >= 0),
        ADD COLUMN last_rob_at bigint NOT NULL DEFAULT 0
          CHECK (last_rob_at BETWEEN 0 AND ${MAX_SAFE}),
        ADD COLUMN rob_successes integer NOT NULL DEFAULT 0
          CHECK (rob_successes >= 0),
        ADD COLUMN rob_failures integer NOT NULL DEFAULT 0
          CHECK (rob_failures >= 0);

      CREATE TABLE user_achievements (
        user_id     text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        achievement text NOT NULL,
        unlocked_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, achievement)
      );
    `,
  },
];
