# Rasselbande Bot

Discord bot with a play-money economy: gambling games, miners, work rewards and
guild votes. TypeScript, backed by the Firebase Realtime Database.

[![CI](https://github.com/simwss/discord-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/simwss/discord-v2/actions/workflows/ci.yml)

## Run it from the published image

Images are built for `linux/amd64` and `linux/arm64` and published to the GitHub
Container Registry on every push to `main`.

```bash
docker pull ghcr.io/simwss/discord-v2:latest
```

```bash
cp .env.example .env    # then fill it in
docker run --rm --env-file .env -p 127.0.0.1:3001:3001 \
  ghcr.io/simwss/discord-v2:latest
```

Or with Compose, which also sets restart policy, log rotation and the health
check:

```bash
docker compose up -d
```

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

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
cp .env.example .env
npm run dev          # watch mode
```

| Script                  | Does                               |
| ----------------------- | ---------------------------------- |
| `npm run dev`           | run from source with reload        |
| `npm run build`         | compile to `dist/`                 |
| `npm start`             | run the compiled build             |
| `npm run register`      | publish slash commands to Discord  |
| `npm test`              | unit tests                         |
| `npm run test:coverage` | tests with coverage thresholds     |
| `npm run lint`          | ESLint (type-aware)                |
| `npm run typecheck`     | `tsc --noEmit`                     |
| `npm run format`        | Prettier                           |
| `npm run check`         | everything CI runs, in one command |

## Configuration

All configuration is environment variables, validated on startup — the process
exits with a list of what is missing rather than failing later with `undefined`.
See [`.env.example`](.env.example) for the full list.

The `FIREBASE_`-prefixed names are preferred, but the unprefixed v1 names
(`API_KEY`, `DATABASE_URL`, `PROJECT_ID`, `APP_ID`, …) are still accepted, so an
existing `.env` keeps working.

## Architecture

```
src/
├── config/       environment parsing and validation (zod)
├── core/         logger, RNG, clock, error types — no app knowledge
├── domain/       pure game and economy rules. No I/O, no discord.js.
├── infra/        Firebase repositories, health server
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
- `GET /ready` — the Discord gateway is connected (503 while connecting).

Set `HEALTH_PORT=0` to disable the server.

## What changed from v1

The rewrite fixed a number of defects that were exploitable rather than
cosmetic:

- **Lost updates on every balance change.** Balances were read with `get` and
  written back with `set`. Two commands running at once both read the old value
  and the second write discarded the first — several full-balance bets could be
  placed simultaneously, and `/daily` could be claimed repeatedly by spamming
  it. All balance writes now go through Realtime Database transactions that
  re-run against the committed server value.
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

The Realtime Database layout is unchanged from v1, so no migration is needed:

```
users/<discordUserId>    balance, authorised, {basic,elite,deluxe}Miners,
                         lastMine, {hourly,daily,weekly}WorkTimestamp
votes/<interactionId>    description, authorId, users{}, closed
blackjackGames/<userId>  in-progress hand
```

Records missing fields (or holding corrupt values) are parsed with defaults
rather than propagating `NaN` into a balance.

## License

MIT
