import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { leaderboardEmbed, type LeaderboardEntry } from "../ui/embeds.js";

const MAX_ENTRIES = 10;

export const leaderboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Schau dir die reichsten Spieler an"),

  async execute(interaction, ctx) {
    // Fetching usernames takes more than Discord's 3 second reply window.
    await interaction.deferReply();

    const top = await ctx.users.topByBalance(MAX_ENTRIES);

    const entries: LeaderboardEntry[] = await Promise.all(
      top.map(async (profile) => {
        try {
          const user = await interaction.client.users.fetch(profile.id);
          return { username: user.displayName, balance: profile.balance };
        } catch {
          // A user who left every mutual guild can no longer be resolved;
          // show the raw ID rather than dropping the whole leaderboard.
          return {
            username: `Unbekannt (${profile.id})`,
            balance: profile.balance,
          };
        }
      }),
    );

    await interaction.editReply({ embeds: [leaderboardEmbed(entries)] });
  },
};
