import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import {
  isLeaderboardMetric,
  LEADERBOARD_LABELS,
  LEADERBOARD_METRICS,
} from "../../domain/leaderboard.js";
import { renderLeaderboard } from "../leaderboard-view.js";

const METRIC_OPTION = "nach";

export const leaderboardCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Schau dir die besten Spieler an")
    .addStringOption((option) =>
      option
        .setName(METRIC_OPTION)
        .setDescription("Wonach soll sortiert werden? Standard: Guthaben")
        .setRequired(false)
        .addChoices(
          ...LEADERBOARD_METRICS.map((metric) => ({
            name: LEADERBOARD_LABELS[metric],
            value: metric,
          })),
        ),
    ),

  async execute(interaction, ctx) {
    const raw = interaction.options.getString(METRIC_OPTION) ?? "balance";
    const metric = isLeaderboardMetric(raw) ? raw : "balance";

    // Fetching usernames takes more than Discord's 3 second reply window.
    await interaction.deferReply();
    await interaction.editReply(
      await renderLeaderboard(interaction.client, ctx, metric, 0),
    );
  },
};
