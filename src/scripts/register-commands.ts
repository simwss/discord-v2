/**
 * Publishes the slash-command definitions to Discord.
 *
 * The bot does this by itself at startup whenever the commands changed, so
 * this script is only needed to force a registration by hand.
 *
 *   npm run register            # uses DISCORD_GUILD_ID if set, else global
 */
import { getEnv } from "../config/env.js";
import {
  registerCommands,
  registrationScope,
} from "../bot/command-registration.js";
import { toError } from "../core/errors.js";

async function main(): Promise<void> {
  const { discord } = getEnv();

  console.log(`Registering commands ${registrationScope(discord)}...`);
  const names = await registerCommands(discord);
  console.log(`Registered: ${names.join(", ")}`);

  if (!discord.guildId) {
    console.log(
      "Global commands can take up to an hour to appear. Set DISCORD_GUILD_ID for instant updates while developing.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(toError(error).message);
  process.exit(1);
});
