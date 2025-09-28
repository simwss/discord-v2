import { ref, set } from "firebase/database";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { GAME_CONFIG } from "../utils/constants.js";

export async function handlePlinkoball(interaction, db, currentUserId) {
  const value = interaction.options.getInteger("betrag");
  const multipliers = GAME_CONFIG.PLINKOBALL_MULTIPLIERS;

  const gambleUser = await ensureUserExists(db, currentUserId, interaction);
  const gambleRef = ref(db, `users/${currentUserId}`);
  
  if (!validateBet(value, gambleUser.balance, interaction)) {
    return;
  }

  await interaction.reply({ content: "Brett wird erstellt..." });
  let ballcords = { x: 0, y: 0 };
  for (let i = 0; i < 7; i++) {
    ballcords.x += Math.random() >= 0.5 ? 1 : 0;
    ballcords.y = i;

    await interaction.editReply({
      content: "",
      embeds: [
        {
          title: "Plinkoball",
          fields: [
            {
              name: "Brett",
              value: `\`${createGameBoard(9, ballcords)}\``,
            },
            {
              name: "Einsatz",
              value: `${value}$`,
            },
          ],
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  gambleUser.balance = Math.round(
    gambleUser.balance - value + multipliers[ballcords.x] * value,
  );
  await set(gambleRef, gambleUser);
  await interaction.editReply({
    embeds: [
      {
        title: "Plinkoball",
        fields: [
          {
            name: "Brett",
            value: `\`${createGameBoard(9, ballcords)}\``,
          },
          {
            name: `${multipliers[ballcords.x]}x Multiplier`,
            value: `${multipliers[ballcords.x] * value}$ Payout`,
          },
          {
            name: "Kontostand",
            value: `${gambleUser.balance}$`,
          },
        ],
      },
    ],
  });
}
function createGameBoard(amount, ballcords) {
  let result = "";

  for (let i = 2; i < amount; i++) {
    result += "|   ";
    for (let j = 0; j < amount - i; j++) {
      result += " ";
    }

    for (let j = 0; j < i; j++) {
      if (ballcords.y + 2 == i && j == ballcords.x) {
        result += "o  ";
      } else {
        result += ".  ";
      }
    }
    for (let j = 0; j < amount - i; j++) {
      result += "  ";
    }
    result += "|\n";
  }
  result += "|    4  2  2  0  0  2  2  4    |";
  return result;
}
