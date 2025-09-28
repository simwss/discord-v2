import { ref, get, set } from "firebase/database";
import { GAME_CONFIG } from "../utils/constants.js";
import { createErrorEmbed, createSuccessEmbed } from "../utils/embeds.js";
import { ERROR_MESSAGES } from "../utils/constants.js";

const { RED_NUMBERS, BLACK_NUMBERS } = GAME_CONFIG.ROULETTE;
export async function handleRoulette(
  interaction,
  db,
  currentUserId,
  componentId,
) {
  const [game, color, userId, bet] = componentId.split("_");
  if (currentUserId !== userId) {
    await interaction.reply({
      embeds: [createErrorEmbed("Fehler", ERROR_MESSAGES.NOT_YOUR_GAME)],
      ephemeral: true,
    });
    return;
  }

  const userRef = ref(db, `users/${currentUserId}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await interaction.reply({
      embeds: [createErrorEmbed("Fehler", ERROR_MESSAGES.USER_NOT_FOUND)],
      ephemeral: true,
    });
    return;
  }
  const betAmount = parseInt(bet, 10);
  const winningNumber = Math.floor(Math.random() * 37);
  const winningColor = getColorForNumber(winningNumber);

  let payoutMultiplier = 1;
  if (winningNumber === 0) {
    payoutMultiplier = 36;
  }
  let win = false;
  if (color === winningColor) {
    win = true;
  }

  const gambleRef = ref(db, `users/${userId}`);
  const gambleSnapshot = await get(gambleRef);
  const gambleUser = gambleSnapshot.val();

  if (win || winningNumber === 0) {
    gambleUser.balance += betAmount * payoutMultiplier;
  } else {
    gambleUser.balance -= betAmount;
  }

  await set(gambleRef, gambleUser);

  const won = win || winningNumber === 0;
  const colorEmoji = winningColor === "red" ? "🟥" : winningColor === "green" ? "🟩" : "⬛";
  const colorName = winningColor === "red" ? "Rot" : winningColor === "green" ? "Grün" : "Schwarz";

  await interaction.update({
    embeds: [createSuccessEmbed(
      `Roulette - Du hast ${won ? "gewonnen" : "verloren"}`,
      `Die Zahl ist **${winningNumber}**, die Farbe ist ${colorName} ${colorEmoji}`,
      won ? 0x00ff00 : 0xff0000,
      [{ name: "Kontostand", value: `**${gambleUser.balance.toLocaleString()}$**` }]
    )],
    components: [],
  });
}

function getColorForNumber(number) {
  if (RED_NUMBERS.includes(number)) return "red";
  if (BLACK_NUMBERS.includes(number)) return "black";
  return "green";
}
