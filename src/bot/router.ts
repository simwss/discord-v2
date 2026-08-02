import type { Interaction, RepliableInteraction } from "discord.js";
import { commandsByName } from "./commands/index.js";
import { componentsByNamespace } from "./components/index.js";
import { decodeCustomId } from "./custom-id.js";
import { errorEmbed, GENERIC_ERROR } from "./ui/embeds.js";
import { respondEphemeral } from "./reply.js";
import { isUserFacingError, toError, UserFacingError } from "../core/errors.js";
import type { BotContext } from "./context.js";

const BANNED_MESSAGE =
  "Hier ist kein Platz für Unterstützer eines Klassensystems";

/**
 * Single entry point for every interaction.
 *
 * Handlers signal expected failures by throwing `UserFacingError`; everything
 * else is logged with its stack and reported generically. v1 wrapped each
 * handler in its own try/catch, so the shape of an error reply depended on
 * which file you happened to be in and several paths swallowed errors whole.
 */
export function createInteractionRouter(
  ctx: BotContext,
): (interaction: Interaction) => Promise<void> {
  return async (interaction: Interaction): Promise<void> => {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isMessageComponent()
    ) {
      return;
    }

    const log = ctx.logger.child({
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      interactionId: interaction.id,
    });

    try {
      if (ctx.bannedUserIds.has(interaction.user.id)) {
        throw new UserFacingError(BANNED_MESSAGE, "Gesperrt");
      }
      await dispatch(interaction, ctx);
    } catch (error) {
      await reportError(interaction, error, log);
    }
  };
}

async function dispatch(
  interaction: Interaction,
  ctx: BotContext,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commandsByName.get(interaction.commandName);
    if (!command) {
      ctx.logger.warn(
        { commandName: interaction.commandName },
        "no handler for command; is the registration stale?",
      );
      throw new UserFacingError("Unbekannter Befehl.");
    }
    await command.execute(interaction, ctx);
    return;
  }

  if (interaction.isMessageComponent()) {
    const id = decodeCustomId(interaction.customId);
    const handler = id ? componentsByNamespace.get(id.namespace) : undefined;

    if (!id || !handler) {
      ctx.logger.warn(
        { customId: interaction.customId },
        "no handler for component",
      );
      throw new UserFacingError(
        "Diese Interaktion wird nicht mehr unterstützt.",
      );
    }
    await handler.handle(interaction, ctx, id);
  }
}

async function reportError(
  interaction: RepliableInteraction,
  error: unknown,
  log: BotContext["logger"],
): Promise<void> {
  const userFacing = isUserFacingError(error);

  if (userFacing) {
    log.debug({ err: error }, "rejected by a rule");
  } else {
    log.error({ err: toError(error) }, "unhandled interaction failure");
  }

  const embed = userFacing
    ? errorEmbed(error.message, error.title)
    : errorEmbed(GENERIC_ERROR);

  try {
    await respondEphemeral(interaction, { embeds: [embed] });
  } catch (replyError) {
    // The interaction token expires after 15 minutes and cannot be revived;
    // there is nothing left to tell the user at this point.
    log.warn({ err: toError(replyError) }, "could not deliver error reply");
  }
}
