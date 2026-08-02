import {
  MessageFlags,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type MessageComponentInteraction,
  type RepliableInteraction,
} from "discord.js";

/**
 * Replies, or edits the existing reply if the interaction was already
 * answered or deferred. v1 open-coded this check in a dozen places and got it
 * wrong in several, producing "interaction has already been acknowledged"
 * crashes that swallowed the real error.
 */
export async function respond(
  interaction: RepliableInteraction,
  options: InteractionReplyOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    const { flags: _flags, ...editable } = options;
    await interaction.editReply(editable);
    return;
  }
  await interaction.reply(options);
}

/** Replies only to the invoking user. */
export async function respondEphemeral(
  interaction: RepliableInteraction,
  options: Omit<InteractionReplyOptions, "flags">,
): Promise<void> {
  await respond(interaction, { ...options, flags: MessageFlags.Ephemeral });
}

/**
 * Updates the message a component belongs to, falling back to an edit when the
 * interaction was already acknowledged (for example after `deferUpdate`).
 */
export async function updateMessage(
  interaction: MessageComponentInteraction,
  options: InteractionUpdateOptions,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    // `update` is unavailable once acknowledged; the option shapes overlap for
    // everything we actually send (embeds, components, content).
    await interaction.editReply(options);
    return;
  }
  await interaction.update(options);
}
