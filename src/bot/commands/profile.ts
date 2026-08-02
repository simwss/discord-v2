import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { profileEmbed } from "../ui/embeds.js";

export const profileCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Schau dir dein Profil an"),

  async execute(interaction, ctx) {
    const profile = await ctx.users.ensure(interaction.user.id);
    await interaction.reply({
      embeds: [profileEmbed(profile, interaction.user.displayName)],
    });
  },
};
