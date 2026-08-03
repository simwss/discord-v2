# Rasselbande Bot

Discord bot with a play-money economy: gambling games, miners, work rewards and
guild votes. TypeScript, backed by Postgres.

[![CI](https://github.com/simwss/discord-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/simwss/discord-v2/actions/workflows/ci.yml)

## Run it from the published image

Images are built for `linux/amd64` and `linux/arm64` and published to the GitHub
Container Registry on every push to `main`.

```bash
docker pull ghcr.io/simwss/discord-v2:latest
```

The bot needs a Postgres 14+ database. Compose brings one up alongside it, sets
the restart policy, log rotation and the health checks, and waits for the
database before starting the bot:

```bash
cp .env.example .env    # then fill it in, including POSTGRES_PASSWORD
docker compose up -d
```

To run the published image against a database you already have, point
`DATABASE_URL` at it:

```bash
docker run --rm --env-file .env -p 127.0.0.1:3001:3001 \
  ghcr.io/simwss/discord-v2:latest
```

The schema is created and kept up to date by the bot itself on startup, so
there is no separate migration step.

Available tags:

| Tag          | Points at                       |
| ------------ | ------------------------------- |
| `latest`     | newest build of `main`          |
| `main-<sha>` | one specific commit (immutable) |
| `1.2.3`      | a `v1.2.3` git tag              |
| `1.2` / `1`  | newest patch / minor of that    |

Every image ships a signed build provenance attestation:

```bash
gh attestation verify oci://ghcr.io/simwss/discord-v2:latest -R simwss/discord-v2
```

## First-time Discord setup

1. Create an application at <https://discord.com/developers/applications>.
2. Under **Bot**, copy the token into `DISCORD_TOKEN`. No privileged intents are
   required — the bot only asks for `Guilds`.
3. Under **General Information**, copy the Application ID into `DISCORD_APP_ID`.
4. Invite the bot with the `bot` and `applications.commands` scopes.
5. Publish the slash commands:

   ```bash
   npm run register
   ```

   Set `DISCORD_GUILD_ID` to register to one guild — that takes effect
   immediately, whereas global registration can take up to an hour. Re-run this
   whenever a command's name, description or options change.

## Local development

Requires Node 22 (see `.nvmrc`) and a Postgres to talk to. The quickest one is
the Compose database on its own:

```bash
npm ci
cp .env.example .env
docker compose up -d postgres
npm run dev          # watch mode
```

| Script                    | Does                               |
| ------------------------- | ---------------------------------- |
| `npm run dev`             | run from source with reload        |
| `npm run build`           | compile to `dist/`                 |
| `npm start`               | run the compiled build             |
| `npm run register`        | publish slash commands to Discord  |
| `npm run import:firebase` | import a Realtime Database export  |
| `npm test`                | unit tests                         |
| `npm run test:coverage`   | tests with coverage thresholds     |
| `npm run lint`            | ESLint (type-aware)                |
| `npm run typecheck`       | `tsc --noEmit`                     |
| `npm run format`          | Prettier                           |
| `npm run check`           | everything CI runs, in one command |

## Configuration

All configuration is environment variables, validated on startup — the process
exits with a list of what is missing rather than failing later with `undefined`.
See [`.env.example`](.env.example) for the full list.

`DATABASE_URL` is the one that matters most: a `postgres://` connection string.
It is checked against that scheme specifically, because the most likely mistake
when upgrading from 2.0 is leaving the old Firebase `DATABASE_URL` in place.

## Architecture

```
src/
├── config/       environment parsing and validation (zod)
├── core/         logger, RNG, clock, error types — no app knowledge
├── domain/       pure game and economy rules. No I/O, no discord.js.
├── infra/        Postgres pool, migrations, repositories, health server
├── services/     orchestration across repositories (money transfer)
├── bot/          discord.js: commands, components, embeds, routing
└── scripts/      operational entry points (command registration)
```

Dependencies point inward: `bot` and `infra` depend on `domain`, never the
reverse. Game rules are pure functions over an injected `Rng` and `Clock`, which
is why they can be tested exhaustively without a Discord connection or a
database.

`src/index.ts` is the only place that constructs concrete dependencies;
everything else receives them through the `BotContext`.

### Adding a command

Create `src/bot/commands/<name>.ts` exporting a `BotCommand` — the slash
definition and the handler live side by side — then add it to the array in
`src/bot/commands/index.ts`. The runtime router and the registration script both
read that array, so a command cannot be registered without a handler or
implemented without being registered.

## Health checks

The container serves two endpoints on `HEALTH_PORT` (default `3001`):

- `GET /health` — the process is alive.
- `GET /ready` — the Discord gateway is connected _and_ the database answers
  (503 otherwise). A bot whose database has gone away can accept interactions
  but cannot answer any of them, so it is not ready.

Set `HEALTH_PORT=0` to disable the server.

## What changed in 2.1: Postgres instead of Firebase

The storage layer was replaced; no game rule changed. What the swap bought:

- **Constraints instead of conventions.** `balance >= 0`, non-negative miner
  counts and the blackjack status/outcome values are now enforced by the
  database. A bug in a guard can no longer leave impossible data behind.
- **Transfers are genuinely atomic.** The Realtime Database transacts over one
  subtree at a time, so `/send` was a debit, then a credit, then a compensating
  refund if the credit failed. Both balances now move inside one transaction,
  with the two rows locked in a fixed order so concurrent transfers queue
  instead of deadlocking.
- **A vote cannot lose a ballot.** Ballots were one JSON map on the vote node;
  they are now one row each, keyed by `(vote_id, user_id)`.
- **The leaderboard stopped reading every user.** It is an indexed
  `ORDER BY balance DESC LIMIT 10`.
- **No more defensive parsing of half-written records.** v2.0 had to treat
  every field as possibly missing or corrupt, because the schemaless database
  allowed it. The schema now guarantees the shape.
- **The database is not on the public internet.** The Firebase client SDK
  authenticated with an API key that shipped in the bot's environment, so the
  security of every balance rested on the Realtime Database rules. Postgres
  listens on the Compose network and on loopback only.

## What changed from v1

The rewrite fixed a number of defects that were exploitable rather than
cosmetic:

- **Lost updates on every balance change.** Balances were read with `get` and
  written back with `set`. Two commands running at once both read the old value
  and the second write discarded the first — several full-balance bets could be
  placed simultaneously, and `/daily` could be claimed repeatedly by spamming
  it. All balance writes now go through a database transaction that locks the
  user's row, so the second command waits and then sees the first one's result.
- **Slots could not be lost.** A losing spin credited a payout of zero _without_
  deducting the stake, so playing cost nothing.
- **Slots were deterministic for the player.** The reels shown during the
  animation were the actual result, and the "Stop" button locked in whatever was
  on screen — you could simply wait for three matching symbols. The outcome is
  now drawn before the animation, which shows filler frames.
- **Blackjack cards had no fixed suit.** The deck stored ranks only and a random
  suit was chosen at render time, so a card's suit changed every redraw. The
  deck is now 52 real cards, shuffled with Fisher-Yates instead of
  `sort(() => Math.random() - 0.5)`, which is measurably biased.
- **Starting a second blackjack hand silently forfeited the first one's stake.**
- **`Math.random()` decided every payout.** Games now use `node:crypto`.
- **Custom IDs were parsed with `split("_")`,** which mis-parsed any ID
  containing an underscore. Encoding and decoding are now one tested module.
- **A `/drink` command was registered with no handler behind it,** because the
  command list and the handler map were maintained separately.
- **The bot requested the privileged `MessageContent` intent,** granting it the
  text of every message in every guild. It is no longer requested.

Two behaviours were deliberately changed rather than preserved:

- Slot payouts are now multipliers on the stake (a 🍒 line returns 2× the stake,
  a net win of 1×). Previously a win added the full multiplier on top of a stake
  that was never deducted.
- The `messages/` auto-responder was removed. It matched a racial slur and
  replied with it, obfuscated in the source as `"digga".replaceAll("d", "n")`.
  The message-handling path went with it; nothing else used it.

## Data

```
users            id, balance, authorised, {basic,elite,deluxe}_miners,
                 last_mine_at, {hourly,daily,weekly}_work_at
votes            id, description, author_id, closed, created_at
vote_ballots     (vote_id, user_id) -> choice
blackjack_games  user_id -> stake, deck, dealer, player, status, outcome
```

Every column is `NOT NULL` with a default, and the constraints carry the rules
that used to live only in application code: a balance cannot go negative, a
miner count cannot go below zero, a blackjack status is one of two strings.
Balances and timestamps are `bigint` but constrained to the range a JS number
represents exactly, so reading them back is lossless.

Migrations live in `src/infra/db/migrations.ts` as an append-only list and run
inside one transaction at startup, guarded by an advisory lock so two
containers starting together cannot both apply them.

### Backups

```bash
docker compose exec -T postgres pg_dump -U rasselbande -Fc rasselbande > backup.dump
docker compose exec -T postgres pg_restore -U rasselbande -d rasselbande --clean < backup.dump
```

### Importing from Firebase (2.0 → 2.1)

Export the Realtime Database first — the Firebase console offers **Realtime
Database → ⋮ → Export JSON**, or, while the old rules still allow it:

```bash
curl "$FIREBASE_DATABASE_URL/.json?print=pretty" -o firebase-export.json
```

Then load it into Postgres:

```bash
docker compose --profile tools run --rm \
  -v ./firebase-export.json:/import.json:ro import /import.json
```

Users and votes carry over; in-progress blackjack hands do not, because their
stakes were already debited and ending those hands costs nothing. The import is
idempotent — re-running it just rewrites the same values. Once the balances
look right in `/leaderboard`, the Firebase project can be deleted.

## License

MIT
