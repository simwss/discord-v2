/**
 * Publishes the slash-command definitions to Discord.
 *
 * Reads from the same `commands` array the bot dispatches on, so registration
 * and implementation cannot drift apart.
 *
 *   npm run register            # uses DISCORD_GUILD_ID if set, else global
 */
import { REST, Routes } from "discord.js";
import { getEnv } from "../config/env.js";
import { commands } from "../bot/commands/index.js";
import { toError } from "../core/errors.js";

async function main(): Promise<void> {
  const env = getEnv();
  const body = commands.map((command) => command.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(env.discord.token);

  const route = env.discord.guildId
    ? Routes.applicationGuildCommands(
        env.discord.applicationId,
        env.discord.guildId,
      )
    : Routes.applicationCommands(env.discord.applicationId);

  const scope = env.discord.guildId
    ? `guild ${env.discord.guildId}`
    : "globally";

  console.log(`Registering ${body.length} commands ${scope}...`);
  await rest.put(route, { body });
  console.log(
    `Registered: ${commands.map((command) => command.data.name).join(", ")}`,
  );

  if (!env.discord.guildId) {
    console.log(
      "Global commands can take up to an hour to appear. Set DISCORD_GUILD_ID for instant updates while developing.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(toError(error).message);
  process.exit(1);
});
