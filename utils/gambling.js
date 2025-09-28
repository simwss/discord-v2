import { ref, get, set } from "firebase/database";
import { ensureUserExists, validateBet } from "./utils.js";
import { createErrorEmbed, createGameEmbed } from "./embeds.js";
import { PLINKOBALL_MULTIPLIERS, SLOTS } from "./constants.js";

// Base gambling command handler
export async function handleGamblingCommand(interaction, db, currentUserId, gameLogic) {
  const bet = interaction.options.getInteger("betrag");
  
  try {
    const user = await ensureUserExists(db, currentUserId, interaction);
    const userRef = ref(db, `users/${currentUserId}`);
    
    if (!validateBet(bet, user.balance, interaction)) {
      return;
    }
    
    return await gameLogic(interaction, user, userRef, bet);
  } catch (error) {
    console.error(`Error in gambling command:`, error);
    
    if (!interaction.replied) {
      await interaction.reply({
        embeds: [createErrorEmbed()],
        ephemeral: true,
      });
    }
  }
}

// Plinkoball game logic
export async function playPlinkoball(interaction, user, userRef, bet) {
  await interaction.reply({ content: "Brett wird erstellt..." });
  
  let ballcords = { x: 0, y: 0 };
  for (let i = 0; i < 7; i++) {
    ballcords.x += Math.random() >= 0.5 ? 1 : 0;
    ballcords.y = i;

    await interaction.editReply({
      content: "",
      embeds: [createPlinkoballEmbed(createGameBoard(9, ballcords), bet)],
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  const multiplier = PLINKOBALL_MULTIPLIERS[ballcords.x];
  const payout = multiplier * bet;
  user.balance = Math.round(user.balance - bet + payout);
  
  await set(userRef, user);
  
  await interaction.editReply({
    embeds: [createPlinkoballEmbed(createGameBoard(9, ballcords), bet, multiplier, payout, user.balance)],
  });
}

// Slot machine game logic
export async function playSlots(interaction, user, userRef, bet) {
  const gameRef = ref(db, `slotGames/${currentUserId}`);
  const gameSnapshot = await get(gameRef);

  if (gameSnapshot.exists() && gameSnapshot.val().status === "spinning") {
    await interaction.reply({
      content: "Du hast bereits ein laufendes Spiel. Bitte beende es zuerst.",
      ephemeral: true,
    });
    return;
  }

  const initialGameState = {
    status: "spinning",
    bet,
  };
  await set(gameRef, initialGameState);

  const embed = createSlotEmbed([], bet);
  const stopButton = new ButtonBuilder()
    .setCustomId(`slots_stop_${currentUserId}_${bet}`)
    .setLabel("Stop")
    .setStyle(ButtonStyle.Danger);

  const actionRow = new ActionRowBuilder().addComponents(stopButton);

  await interaction.reply({
    embeds: [embed],
    components: [actionRow],
  });

  // Start spinning logic would go here...
  // (This is a simplified version - the full implementation would include the spinning animation)
}

// Helper function for plinkoball board creation
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
