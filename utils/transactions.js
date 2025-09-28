import { ref, get, set } from "firebase/database";
import { ensureUserExists, validateBet } from "./utils.js";
import { createErrorEmbed, createSuccessEmbed } from "./embeds.js";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "./constants.js";

// Send money to another user
export async function sendMoney(interaction, db, senderId, receiverId, amount) {
  try {
    // Validate sender
    const senderData = await ensureUserExists(db, senderId, interaction);
    const senderRef = ref(db, `users/${senderId}`);

    // Check if receiver exists
    const receiverRef = ref(db, `users/${receiverId}`);
    const receiverSnapshot = await get(receiverRef);
    
    if (!receiverSnapshot.exists()) {
      await interaction.reply({
        embeds: [createErrorEmbed("Fehler", ERROR_MESSAGES.RECEIVER_NOT_REGISTERED)],
        ephemeral: true,
      });
      return false;
    }

    // Validate amount
    if (amount <= 0) {
      await interaction.reply({
        embeds: [createErrorEmbed("Fehler", ERROR_MESSAGES.NEGATIVE_AMOUNT)],
        ephemeral: true,
      });
      return false;
    }

    if (senderData.balance < amount) {
      await interaction.reply({
        embeds: [createErrorEmbed("Fehler", ERROR_MESSAGES.NOT_ENOUGH_MONEY)],
        ephemeral: true,
      });
      return false;
    }

    // Perform transaction
    const receiverData = receiverSnapshot.val();
    senderData.balance -= amount;
    receiverData.balance += amount;

    await set(senderRef, senderData);
    await set(receiverRef, receiverData);

    // Success response
    await interaction.reply({
      embeds: [createSuccessEmbed(
        SUCCESS_MESSAGES.TRANSACTION_SUCCESS,
        `Du hast erfolgreich **${amount.toLocaleString()}** an <@${receiverId}> versendet`,
        undefined,
        [
          { name: "Kontostand", value: `**${senderData.balance.toLocaleString()}$**` }
        ]
      )]
    });

    return true;
  } catch (error) {
    console.error("Error in sendMoney:", error);
    
    if (!interaction.replied) {
      await interaction.reply({
        embeds: [createErrorEmbed()],
        ephemeral: true,
      });
    }
    return false;
  }
}

// Update user balance (for gambling, work, etc.)
export async function updateBalance(db, userId, amount, reason = "Transaction") {
  try {
    const userRef = ref(db, `users/${userId}`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnapshot.val();
    userData.balance += amount;
    
    await set(userRef, userData);
    return userData;
  } catch (error) {
    console.error(`Error updating balance for user ${userId}:`, error);
    throw error;
  }
}

// Get user balance safely
export async function getUserBalance(db, userId) {
  try {
    const userRef = ref(db, `users/${userId}`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists()) {
      return 0;
    }

    return userSnapshot.val().balance || 0;
  } catch (error) {
    console.error(`Error getting balance for user ${userId}:`, error);
    return 0;
  }
}
