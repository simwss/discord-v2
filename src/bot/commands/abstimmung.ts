import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { tally, type Vote } from "../../domain/vote.js";
import { voteEmbed } from "../ui/embeds.js";
import { voteButtons } from "../ui/components.js";

const TOPIC_OPTION = "thema";
const MAX_TOPIC_LENGTH = 500;

export const abstimmungCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("abstimmung")
    .setDescription("Erstelle eine neue Abstimmung für das Volk")
    .addStringOption((option) =>
      option
        .setName(TOPIC_OPTION)
        .setDescription("Das Thema der Abstimmung")
        .setRequired(true)
        .setMaxLength(MAX_TOPIC_LENGTH),
    ),

  async execute(interaction, ctx) {
    const description = interaction.options.getString(TOPIC_OPTION, true);

    const vote: Vote = {
      id: interaction.id,
      description,
      authorId: interaction.user.id,
      users: {},
      closed: false,
      createdAt: ctx.clock.now(),
    };

    await ctx.votes.create(vote);

    await interaction.reply({
      embeds: [
        voteEmbed({
          description,
          authorName: interaction.user.displayName,
          authorId: interaction.user.id,
          tally: tally({}),
        }),
      ],
      components: [voteButtons(vote.id)],
    });
  },
};
