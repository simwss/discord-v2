import { createHash } from "node:crypto";
import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { Logger } from "pino";
import type { Env } from "../config/env.js";
import type { Db } from "../infra/db/pool.js";
import { commands } from "./commands/index.js";

type DiscordConfig = Env["discord"];

const STATE_KEY = "commands_fingerprint";

function commandBodies(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commands.map((command) => command.data.toJSON());
}

export function registrationScope(discord: DiscordConfig): string {
  return discord.guildId ? `guild ${discord.guildId}` : "globally";
}

/**
 * Identifies exactly what would be sent to Discord, including where it goes.
 * Switching between guild and global registration therefore also counts as a
 * change.
 */
export function commandsFingerprint(
  discord: DiscordConfig,
  bodies: readonly unknown[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        applicationId: discord.applicationId,
        guildId: discord.guildId ?? null,
        bodies,
      }),
    )
    .digest("hex");
}

/** Publishes every command definition to Discord, replacing the old set. */
export async function registerCommands(
  discord: DiscordConfig,
): Promise<string[]> {
  const rest = new REST({ version: "10" }).setToken(discord.token);
  const route = discord.guildId
    ? Routes.applicationGuildCommands(discord.applicationId, discord.guildId)
    : Routes.applicationCommands(discord.applicationId);

  await rest.put(route, { body: commandBodies() });
  return commands.map((command) => command.data.name);
}

/**
 * Registers the commands at startup, but only when they differ from what was
 * last registered. A deploy that changes a command therefore needs no manual
 * registration step, while ordinary restarts make no Discord API call.
 *
 * A failure is logged and swallowed: the bot can still serve the commands
 * Discord already knows, and the next start tries again because the stored
 * fingerprint was not updated.
 */
export async function syncCommands(
  pool: Db,
  discord: DiscordConfig,
  logger: Logger,
): Promise<void> {
  const fingerprint = commandsFingerprint(discord, commandBodies());

  try {
    const { rows } = await pool.query<{ value: string }>(
      "SELECT value FROM bot_state WHERE key = $1",
      [STATE_KEY],
    );
    if (rows[0]?.value === fingerprint) {
      logger.info("slash commands unchanged, skipping registration");
      return;
    }

    const names = await registerCommands(discord);
    await pool.query(
      `INSERT INTO bot_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = now()`,
      [STATE_KEY, fingerprint],
    );
    logger.info(
      { scope: registrationScope(discord), commands: names },
      "slash commands registered",
    );
  } catch (error) {
    logger.error({ err: error }, "slash command registration failed");
  }
}
