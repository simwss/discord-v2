import { Status } from "discord.js";
import { getEnv } from "./config/env.js";
import { getLogger } from "./core/logger.js";
import { cryptoRng } from "./core/random.js";
import { systemClock } from "./core/clock.js";
import { toError } from "./core/errors.js";
import { createFirebase } from "./infra/firebase/client.js";
import { UserRepository } from "./infra/firebase/user-repository.js";
import { VoteRepository } from "./infra/firebase/vote-repository.js";
import { BlackjackRepository } from "./infra/firebase/blackjack-repository.js";
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

  const { db } = createFirebase();
  const users = new UserRepository(db);

  const ctx: BotContext = {
    users,
    votes: new VoteRepository(db),
    blackjack: new BlackjackRepository(db),
    transfers: new TransferService(users, logger),
    rng: cryptoRng,
    clock: systemClock,
    logger,
    bannedUserIds: new Set(env.bannedUserIds),
  };

  const client = createBotClient(ctx);

  const health = startHealthServer(
    env.healthPort,
    { isReady: () => client.ws.status === Status.Ready },
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
  });

  await client.login(env.discord.token);
}

main().catch((error: unknown) => {
  // The logger may not exist yet if config validation failed, so this is the
  // one place a bare stderr write is the right call.
  process.stderr.write(`${toError(error).stack ?? String(error)}\n`);
  process.exit(1);
});
