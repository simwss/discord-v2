import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { UserFacingError } from "../../core/errors.js";
import { profileEmbed } from "../ui/embeds.js";

const USER_OPTION = "nutzer";

export const profileCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Schau dir dein Profil oder das eines anderen an")
    .addUserOption((option) =>
      option
        .setName(USER_OPTION)
        .setDescription("Wessen Profil? Leer lassen für dein eigenes")
        .setRequired(false),
    ),

  async execute(interaction, ctx) {
    const target = interaction.options.getUser(USER_OPTION) ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    // Only your own profile is created on the fly. Looking someone up must not
    // hand a starting balance to a user who has never touched the bot — and it
    // must not put a row on the leaderboard that nobody plays.
    const profile = isSelf
      ? await ctx.users.ensure(target.id)
      : await ctx.users.find(target.id);

    if (!profile) {
      throw new UserFacingError(
        `${target.displayName} hat den Bot noch nie benutzt.`,
        "Kein Profil",
      );
    }

    const [achievements, bounty] = await Promise.all([
      ctx.achievements.list(target.id),
      ctx.users.bountyOn(target.id),
    ]);

    await interaction.reply({
      embeds: [
        profileEmbed(
          profile,
          target.displayName,
          achievements,
          ctx.rng,
          bounty,
        ),
      ],
    });
  },
};
