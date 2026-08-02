import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { UserFacingError } from "../../core/errors.js";
import { successEmbed } from "../ui/embeds.js";
import { mention } from "../ui/format.js";
import { respondEphemeral } from "../reply.js";
import { COLORS } from "../ui/colors.js";

const USER_OPTION = "nutzer";

export const authorisierenCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("authorisieren")
    .setDescription("Autorisiere einen Nutzer")
    .addUserOption((option) =>
      option
        .setName(USER_OPTION)
        .setDescription("Nutzer zum Autorisieren")
        .setRequired(true),
    ),

  async execute(interaction, ctx) {
    const target = interaction.options.getUser(USER_OPTION, true);

    if (!(await ctx.users.isAuthorised(interaction.user.id))) {
      throw new UserFacingError(
        "Du hast keine Berechtigung, andere Nutzer zu autorisieren.",
        "Nicht autorisiert",
      );
    }

    if (target.bot) {
      throw new UserFacingError("Bots können nicht autorisiert werden.");
    }

    // Create the record first so authorising a user who has never used the
    // bot does not write a half-populated row.
    await ctx.users.ensure(target.id);

    if (await ctx.users.isAuthorised(target.id)) {
      await respondEphemeral(interaction, {
        embeds: [
          successEmbed(
            "Bereits autorisiert",
            `${mention(target.id)} ist schon autorisiert.`,
          ).setColor(COLORS.WARNING),
        ],
      });
      return;
    }

    await ctx.users.setAuthorised(target.id, true);
    ctx.logger.info(
      { actorId: interaction.user.id, targetId: target.id },
      "user authorised",
    );

    await interaction.reply({
      embeds: [
        successEmbed(
          "Autorisierung erfolgreich",
          `${mention(target.id)} wurde autorisiert.`,
        ),
      ],
      allowedMentions: { users: [target.id] },
    });
  },
};
