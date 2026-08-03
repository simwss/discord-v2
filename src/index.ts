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
import { TransferService } from "./services/transfer-service.js";
import { startHealthServer } from "./infra/health-server.js";
import { createBotClient, installShutdownHandlers } from "./bot/client.js";
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

  const users = new UserRepository(pool);

  const ctx: BotContext = {
    users,
    votes: new VoteRepository(pool),
    blackjack: new BlackjackRepository(pool),
    transfers: new TransferService(users, logger),
    rng: cryptoRng,
    clock: systemClock,
    logger,
    bannedUserIds: new Set(env.bannedUserIds),
  };

  const client = createBotClient(ctx);

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
