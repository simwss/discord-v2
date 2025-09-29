import { ref, get, set } from "firebase/database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { GAME_CONFIG } from "../utils/constants.js";
import { createSlotEmbed } from "../utils/embeds.js";

export async function handleSlots(interaction, db, currentUserId) {
  try {
    const bet = interaction.options.getInteger("betrag");
    const SLOTS = GAME_CONFIG.SLOTS;
    const user = await ensureUserExists(db, currentUserId, interaction);
    const userRef = ref(db, `users/${currentUserId}`);
    const gameRef = ref(db, `slotGames/${currentUserId}`);

    // Check for existing game
    const gameSnapshot = await get(gameRef);
    if (gameSnapshot.exists() && gameSnapshot.val().status === "spinning") {
      await interaction.reply({
        content: "Du hast bereits ein laufendes Spiel. Bitte beende es zuerst.",
        ephemeral: true,
      });
      return;
    }

    // Validate bet
    if (!validateBet(bet, user.balance, interaction)) {
      return;
    }

    // Initialize game state
    const initialGameState = {
      status: "spinning",
      bet,
      startedAt: Date.now(),
    };
    await set(gameRef, initialGameState);

    // Create initial embed and button
    const embed = createSlotEmbed([], bet, "spinning");
    const stopButton = new ButtonBuilder()
      .setCustomId(`slots_stop_${currentUserId}_${bet}`)
      .setLabel("Stop")
      .setStyle(ButtonStyle.Danger);
    const actionRow = new ActionRowBuilder().addComponents(stopButton);

    // Use withResponse instead of fetchReply to fix the deprecation warning
    const message = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      fetchReply: true // Keep this for now, but we'll fix the channel caching issue
    });

    let spinningInterval;
    let isCollectorActive = true;
    let currentSlotResults = Array.from(
      { length: 3 },
      () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
    );

    // Store channel reference separately
    const channel = interaction.channel;

    // Spinning animation function
    async function updateSpinningAnimation() {
      try {
        if (!isCollectorActive) return;

        // Update the current slot results
        currentSlotResults = Array.from(
          { length: 3 },
          () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
        );
        
        const spinningEmbed = createSlotEmbed(currentSlotResults, bet, "spinning");
        
        console.log("Updating slots display:", currentSlotResults);
        
        // Use channel.messages.edit instead of message.edit to avoid caching issues
        await channel.messages.edit(message.id, {
          embeds: [spinningEmbed],
          components: [actionRow],
        });
      } catch (error) {
        console.error("Error updating spinning animation:", error);
        // If editing fails, stop the animation
        clearInterval(spinningInterval);
        isCollectorActive = false;
      }
    }

    // Start spinning animation immediately
    await updateSpinningAnimation(); // Show first spin immediately
    spinningInterval = setInterval(updateSpinningAnimation, 1000);

    // Create collector on the actual message
    const filter = (i) => {
      return i.customId === `slots_stop_${currentUserId}_${bet}` && 
             i.user.id === currentUserId;
    };

    const collector = message.createMessageComponentCollector({
      filter,
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (!isCollectorActive) return;
      isCollectorActive = false;
      
      // Immediately acknowledge the interaction
      await i.deferUpdate();
      
      clearInterval(spinningInterval);
      collector.stop();

      try {
        // Use the CURRENT slot results that were showing when button was pressed
        const finalSlotResults = [...currentSlotResults];

        console.log("Final slot results:", finalSlotResults);

        // Calculate payout
        let payoutMultiplier = -1; // Default to loss
        let winAmount = 0;

        if (finalSlotResults.every((symbol) => symbol === finalSlotResults[0])) {
          payoutMultiplier = SLOTS.PAYOUTS[finalSlotResults[0]] || 0;
          winAmount = bet * payoutMultiplier;
        }

        // Update user balance
        const newBalance = user.balance + winAmount;
        await set(userRef, {
          ...user,
          balance: newBalance
        });

        // Clear game state
        await set(gameRef, null);

        // Create result embed
        const resultEmbed = createSlotEmbed(
          finalSlotResults, 
          bet, 
          payoutMultiplier === -1 ? "lost" : "won",
          newBalance,
          winAmount
        );

        // Use the original interaction to edit the reply
        await i.editReply({
          embeds: [resultEmbed],
          components: [],
        });

      } catch (error) {
        console.error("Error processing slot result:", error);
        await i.followUp({
          content: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.",
          ephemeral: true,
        });
      }
    });

    collector.on('end', async (collected, reason) => {
      isCollectorActive = false;
      clearInterval(spinningInterval);
      
      // Clean up if collector ends without collection (timeout)
      if (reason === 'time') {
        try {
          await set(gameRef, null);
          // Use channel.messages.edit for cleanup too
          await channel.messages.edit(message.id, {
            content: "⏰ Slot-Spiel abgelaufen. Starte ein neues Spiel!",
            components: [],
          });
        } catch (error) {
          console.error("Error cleaning up timed out game:", error);
        }
      }
    });

  } catch (error) {
    console.error("Error in handleSlots:", error);
    
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.",
          components: [],
        });
      } else {
        await interaction.reply({
          content: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuche es später erneut.",
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error("Error sending error message:", replyError);
    }
  }
}