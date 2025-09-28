import { ref, set } from "firebase/database";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { createVoteEmbed, createErrorEmbed } from "../utils/embeds.js";

export async function handleAbstimmung(interaction, db, currentUserId) {
  try {
    const userInput = interaction.options.getString("thema");

    const newVote = {
      id: interaction.id,
      users: {},
      description: userInput,
      closed: false,
    };

    const voteRef = ref(db, `votes/${interaction.id}`);
    await set(voteRef, newVote);

    const embed = createVoteEmbed(userInput, interaction.user.username, currentUserId);

    const yesButton = new ButtonBuilder()
      .setCustomId(`vote_yes_${interaction.id}`)
      .setLabel("Zustimmen")
      .setStyle(ButtonStyle.Success);

    const noButton = new ButtonBuilder()
      .setCustomId(`vote_no_${interaction.id}`)
      .setLabel("Ablehnen")
      .setStyle(ButtonStyle.Danger);

    const endButton = new ButtonBuilder()
      .setCustomId(`vote_end_${interaction.id}`)
      .setLabel("Beenden")
      .setStyle(ButtonStyle.Primary);

    const actionRow = new ActionRowBuilder().addComponents(
      yesButton,
      noButton,
      endButton,
    );

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
    });
  } catch (error) {
    console.error("Fehler beim Verarbeiten der Abstimmung:", error);
    await interaction.reply({
      embeds: [createErrorEmbed("Fehler", "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.")],
      ephemeral: true,
    });
  }
}
