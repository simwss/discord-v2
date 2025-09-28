import { ref, get, set } from "firebase/database";
import { getHandValue, createBlackjackEmbed } from "../utils/blackjack.js";
import pkg from "discord.js";
const { ActionRowBuilder, ButtonBuilder } = pkg;

export async function handleBlackjackHitStand(
  interaction,
  db,
  currentUserId,
  componentId,
) {
  const [game, action, userId] = componentId.split("_");

  if (currentUserId !== userId) {
    await interaction.reply({
      content: "Das ist nicht dein Spiel.",
      ephemeral: true,
    });
    return;
  }

  const gameRef = ref(db, `blackjackGames/${currentUserId}`);
  const gameSnapshot = await get(gameRef);
  const gameState = gameSnapshot.val();
  if (!gameState || gameState.status !== "playing") {
    await interaction.reply({
      content: "Du hast kein laufendes Spiel.",
      ephemeral: true,
    });
    return;
  }

  if (action === "hit") {
    gameState.playerCards.push(gameState.deck.pop());
    const playerValue = getHandValue(gameState.playerCards);
    if (playerValue > 21) {
      gameState.status = "lost";
      await finishGame(interaction, gameState, currentUserId, db, "lost");
      return;
    }
  } else if (action === "stand") {
    gameState.status = "dealer_turn";
  }

  await set(gameRef, gameState);

  if (gameState.status === "lost") {
    await finishGame(interaction, gameState, currentUserId, db, "lost");
  } else if (gameState.status === "dealer_turn") {
    await dealerTurn(interaction, gameState, currentUserId, db);
  } else {
    const embed = createBlackjackEmbed(
      gameState.dealerCards,
      gameState.playerCards,
      false,
    );

    const hitButton = new ButtonBuilder()
      .setCustomId(`blackjack_hit_${currentUserId}`)
      .setLabel("Hit")
      .setStyle("Success");

    const standButton = new ButtonBuilder()
      .setCustomId(`blackjack_stand_${currentUserId}`)
      .setLabel("Stand")
      .setStyle("Danger");

    const actionRow = new ActionRowBuilder().addComponents(
      hitButton,
      standButton,
    );

    await interaction.update({
      embeds: [embed],
      components: [actionRow],
    });
  }
}

async function dealerTurn(interaction, gameState, userId, db) {
  while (getHandValue(gameState.dealerCards) < 17) {
    gameState.dealerCards.push(gameState.deck.pop());
  }

  const dealerValue = getHandValue(gameState.dealerCards);
  const playerValue = getHandValue(gameState.playerCards);
  if (
    dealerValue < 21 &&
    playerValue === 21 &&
    gameState.playerCards.length === 2
  ) {
    gameState.status = "blackjack";
  } else if (dealerValue > 21 || playerValue > dealerValue) {
    gameState.status = "won";
  } else if (playerValue === dealerValue) {
    gameState.status = "draw";
  } else {
    gameState.status = "lost";
  }

  await set(ref(db, `blackjackGames/${userId}`), gameState);

  await finishGame(interaction, gameState, userId, db, gameState.status);
}

async function finishGame(interaction, gameState, userId, db, result) {
  const gambleRef = ref(db, `users/${userId}`);
  const gambleSnapshot = await get(gambleRef);
  const gambleUser = gambleSnapshot.val();

  switch (result) {
    case "blackjack":
      gambleUser.balance += gameState.bet * 1.5;
      break;
    case "won":
      gambleUser.balance += gameState.bet;
      break;
    case "lost":
      gambleUser.balance -= gameState.bet;
      break;
  }

  await set(gambleRef, gambleUser);

  await set(ref(db, `blackjackGames/${userId}`), null);

  const embed = createBlackjackEmbed(
    gameState.dealerCards,
    gameState.playerCards,
    true,
  );
  embed.fields.push({ name: "Kontostand", value: `**${gambleUser.balance}**` });

  embed.title += ` - Du hast ${
    result === "won" || result === "blackjack"
      ? "gewonnen"
      : result === "lost"
        ? "verloren"
        : "ein Unentschieden erreicht"
  }`;

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}
