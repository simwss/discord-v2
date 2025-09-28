import { ref, get } from "firebase/database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { createRouletteEmbed } from "../utils/embeds.js";

export async function handleRoulette(interaction, db, currentUserId) {
  const bet = interaction.options.getInteger("betrag");

  const gambleUser = await ensureUserExists(db, currentUserId, interaction);
  
  if (!validateBet(bet, gambleUser.balance, interaction)) {
    return;
  }

  const embed = createRouletteEmbed(null, bet);

  const redButton = new ButtonBuilder()
    .setCustomId(`roulette_red_${currentUserId}_${bet}`)
    .setLabel("Red")
    .setStyle(ButtonStyle.Danger);

  const blackButton = new ButtonBuilder()
    .setCustomId(`roulette_black_${currentUserId}_${bet}`)
    .setLabel("Black")
    .setStyle(ButtonStyle.Secondary);

  const greenButton = new ButtonBuilder()
    .setCustomId(`roulette_green_${currentUserId}_${bet}`)
    .setLabel("Green")
    .setStyle(ButtonStyle.Success);

  const actionRow = new ActionRowBuilder().addComponents(
    redButton,
    blackButton,
    greenButton,
  );

  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
  });
}
