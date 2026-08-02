import { Client, Events, GatewayIntentBits } from "discord.js";
import type { Logger } from "pino";
import { createInteractionRouter } from "./router.js";
import { toError } from "../core/errors.js";
import type { BotContext } from "./context.js";

/**
 * Only the Guilds intent is requested. v1 also asked for GuildMessages and
 * MessageContent — MessageContent is a privileged intent that grants the bot
 * the text of every message in every guild, and nothing here needs it.
 */
export function createBotClient(ctx: BotContext): Client {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const route = createInteractionRouter(ctx);

  client.once(Events.ClientReady, (ready) => {
    ctx.logger.info(
      { tag: ready.user.tag, guilds: ready.guilds.cache.size },
      "bot online",
    );
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void route(interaction);
  });

  client.on(Events.Error, (error: Error) => {
    ctx.logger.error({ err: error }, "discord client error");
  });

  client.on(Events.Warn, (message: string) => {
    ctx.logger.warn({ message }, "discord client warning");
  });

  return client;
}

/** Registers process-level handlers that close the gateway connection cleanly. */
export function installShutdownHandlers(
  client: Client,
  logger: Logger,
  onShutdown?: () => Promise<void>,
): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "shutting down");
    void (async () => {
      try {
        await onShutdown?.();
        await client.destroy();
      } catch (error) {
        logger.error({ err: toError(error) }, "error during shutdown");
      } finally {
        process.exit(0);
      }
    })();
  };

  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: toError(reason) }, "unhandled promise rejection");
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception, exiting");
    process.exit(1);
  });
}
