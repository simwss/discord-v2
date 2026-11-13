import { Status } from "discord.js";
import { getEnv } from "./config/env.js";
import { getLogger } from "./core/logger.js";
import { cryptoRng } from "./core/random.js";
import { systemClock } from "./core/clock.js";
import { toError } from "./core/errors.js";
import { createPool, isDatabaseReachable } from "./infra/db/pool.js";
import { runMigrations } from "./infra/db/migrate.js";
import { UserRepository } from "./infra/db/user-repository.js";
import { VoteRepository } from "./infra/db/vote-repository.js";
import { BlackjackRepository } from "./infra/db/blackjack-repository.js";
import { AchievementRepository } from "./infra/db/achievement-repository.js";
import { TransferService } from "./services/transfer-service.js";
import { PositionRepository } from "./infra/db/position-repository.js";
import { FinnhubClient } from "./infra/market/finnhub.js";
import { CoinbaseClient } from "./infra/market/coinbase.js";
import { MarketService } from "./services/market-service.js";
import { LiquidationJob } from "./services/liquidation-job.js";
import { liquidationNoticeEmbed } from "./bot/ui/trading-embeds.js";
import { startHealthServer } from "./infra/health-server.js";
import { createBotClient, installShutdownHandlers } from "./bot/client.js";
import { syncCommands } from "./bot/command-registration.js";
import type { BotContext } from "./bot/context.js";

/**
 * Composition root: the only place that constructs concrete dependencies.
 * Everything below receives them by injection.
 */
async function main(): Promise<void> {
  const env = getEnv();
  const logger = getLogger();

  logger.info({ nodeEnv: env.nodeEnv }, "starting rasselbande bot");

  const pool = createPool(logger);
  // Before the gateway connects, so a schema problem surfaces as a failed
  // start rather than as commands failing one at a time in production.
  await runMigrations(pool, logger);
  // A deploy that changed a command takes effect without a manual step.
  await syncCommands(pool, env.discord, logger);

  const users = new UserRepository(pool);
  const positions = new PositionRepository(pool);

  if (!env.finnhubApiKey) {
    logger.warn("FINNHUB_API_KEY is not set; only crypto can be traded");
  }
  const market = new MarketService(
    env.finnhubApiKey ? new FinnhubClient(env.finnhubApiKey) : null,
    new CoinbaseClient(),
    systemClock,
  );

  const ctx: BotContext = {
    users,
    votes: new VoteRepository(pool),
    blackjack: new BlackjackRepository(pool),
    achievements: new AchievementRepository(pool),
    transfers: new TransferService(users, logger),
    positions,
    market,
    rng: cryptoRng,
    clock: systemClock,
    logger,
    bannedUserIds: new Set(env.bannedUserIds),
  };

  const client = createBotClient(ctx);

  const liquidations = new LiquidationJob(
    positions,
    market,
    systemClock,
    logger,
    async (position, price) => {
      const user = await client.users.fetch(position.userId);
      await user.send({ embeds: [liquidationNoticeEmbed(position, price)] });
    },
  );
  liquidations.start();

  const health = startHealthServer(
    env.healthPort,
    {
      // A bot whose database has gone away can accept interactions but cannot
      // answer any of them, so it is not ready.
      isReady: async () =>
        client.ws.status === Status.Ready &&
        (await isDatabaseReachable(pool, logger)),
    },
    logger,
  );

  installShutdownHandlers(client, logger, async () => {
    liquidations.stop();
    await new Promise<void>((resolve) => {
      if (!health) {
        resolve();
        return;
      }
      health.close(() => {
        resolve();
      });
    });
    await pool.end();
  });

  await client.login(env.discord.token);
}

main().catch((error: unknown) => {
  // The logger may not exist yet if config validation failed, so this is the
  // one place a bare stderr write is the right call.
  process.stderr.write(`${toError(error).stack ?? String(error)}\n`);
  process.exit(1);
});
