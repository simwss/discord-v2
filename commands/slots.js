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

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
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
      
      interaction.editReply({
        embeds: [spinningEmbed],
        components: [actionRow],
      }).catch(console.error);
    }

    // Start spinning animation
    spinningInterval = setInterval(updateSpinningAnimation, 1000);

    // Create collector for stop button
    const filter = (i) => 
      i.customId === `slots_stop_${currentUserId}_${bet}` && 
      i.user.id === currentUserId;

    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (!isCollectorActive) return;
      isCollectorActive = false;
      
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
        user.balance += winAmount;
        await set(userRef, user);

        // Clear game state
        await set(gameRef, null);

        // Create result embed
        const resultEmbed = createSlotEmbed(
          finalSlotResults, 
          bet, 
          payoutMultiplier === -1 ? "lost" : "won",
          user.balance,
          winAmount
        );

        await i.update({
          embeds: [resultEmbed],
          components: [],
        });

      } catch (error) {
        console.error("Error processing slot result:", error);
        await i.reply({
          content: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.",
          ephemeral: true,
        });
      }
    });

    collector.on("end", () => {
      isCollectorActive = false;
      clearInterval(spinningInterval);
      
      // Clean up if collector ends without collection (timeout)
      if (collector.endReason === "time") {
        set(gameRef, null).catch(console.error);
        
        interaction.editReply({
          content: "Slot-Spiel abgelaufen. Starte ein neues Spiel!",
          components: [],
        }).catch(console.error);
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