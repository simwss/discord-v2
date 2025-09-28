import { ref, set, get } from "firebase/database";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { createDeck, createBlackjackEmbed } from "../utils/blackjack.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export async function handleBlackjack(interaction, db, currentUserId) {
  const bet = interaction.options.getInteger("betrag");

  const gambleUser = await ensureUserExists(db, currentUserId, interaction);

  if (!validateBet(bet, gambleUser.balance, interaction)) {
    return;
  }

  const deck = createDeck();

  const dealerCards = [deck.pop()];
  const playerCards = [deck.pop(), deck.pop()];

  const gameState = {
    bet,
    dealerCards,
    playerCards,
    status: "playing",
    deck,
  };

  const gameRef = ref(db, `blackjackGames/${currentUserId}`);
  await set(gameRef, gameState);

  const embed = createBlackjackEmbed(dealerCards, playerCards, false);

  const hitButton = new ButtonBuilder()
    .setCustomId(`blackjack_hit_${currentUserId}`)
    .setLabel("Hit")
    .setStyle(ButtonStyle.Success);

  const standButton = new ButtonBuilder()
    .setCustomId(`blackjack_stand_${currentUserId}`)
    .setLabel("Stand")
    .setStyle(ButtonStyle.Danger);

  const actionRow = new ActionRowBuilder().addComponents(
    hitButton,
    standButton,
  );

  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
  });
}
