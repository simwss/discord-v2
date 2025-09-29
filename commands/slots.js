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

    const message = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      fetchReply: true
    });

    let spinningInterval;
    let isCollectorActive = true;

    // Spinning animation function
    function updateSpinningAnimation() {
      const slotResults = Array.from(
        { length: 3 },
        () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
      );
      
      const spinningEmbed = createSlotEmbed(slotResults, bet, "spinning");
      
      // Use message.edit instead of interaction.editReply for updates
      message.edit({
        embeds: [spinningEmbed],
        components: [actionRow],
      }).catch(console.error);
    }

    // Start spinning animation
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
        // Generate final results
        const finalSlotResults = Array.from(
          { length: 3 },
          () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
        );

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
          await message.edit({
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