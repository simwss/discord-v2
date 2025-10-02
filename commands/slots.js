
import { ref, get, set, update } from "firebase/database";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { ensureUserExists, validateBet } from "../utils/utils.js";
import { GAME_CONFIG } from "../utils/constants.js";
import { createSlotEmbed } from "../utils/embeds.js";

export async function handleSlots(interaction, db, currentUserId) {
  let spinningInterval;
  let isCollectorActive = true;
  let currentSlotResults = [];
  let message;

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

    // Correct way: use fetchReply instead of withResponse
    message = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      fetchReply: true,
    });

    // Initial slot roll
    currentSlotResults = Array.from(
      { length: 3 },
      () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)],
    );

    // Spinning animation
async function updateSpinningAnimation() {
  try {
    if (!isCollectorActive || !message) return;

    currentSlotResults = Array.from(
      { length: 3 },
      () => SLOTS.SYMBOLS[Math.floor(Math.random() * SLOTS.SYMBOLS.length)]
    );

    const spinningEmbed = createSlotEmbed(currentSlotResults, bet, "spinning");

    await message.edit({
      embeds: [spinningEmbed],
      components: [actionRow],
    });
  } catch (error) {
    console.error("Error updating spinning animation:", error);
    if (spinningInterval) clearInterval(spinningInterval);
    isCollectorActive = false;
  }
}


    // Start animation
    await updateSpinningAnimation();
    spinningInterval = setInterval(updateSpinningAnimation, 1000);

    // Collector for stop button
    const filter = (i) =>
      i.customId === `slots_stop_${currentUserId}_${bet}` &&
      i.user.id === currentUserId;

      await interaction.reply({
        embeds: [embed],
        components: [actionRow],
        fetchReply: true,
      });

      const message = await interaction.fetchReply(); // ensures Message instance

      const collector = message.createMessageComponentCollector({
        filter,
        time: 60000,
      });
    collector.on("collect", async (i) => {
      if (!isCollectorActive) return;
      isCollectorActive = false;

      await i.deferUpdate();

      if (spinningInterval) clearInterval(spinningInterval);
      collector.stop();

      try {
        const finalSlotResults = [...currentSlotResults];
        console.log("Final slot results:", finalSlotResults);

        // Payout calculation
        let payoutMultiplier = -1;
        let winAmount = 0;

        if (finalSlotResults.every((s) => s === finalSlotResults[0])) {
          payoutMultiplier = SLOTS.PAYOUTS[finalSlotResults[0]] || 0;
          winAmount = bet * payoutMultiplier;
        }

        const newBalance = user.balance + winAmount;

        // Safer to use update instead of overwriting
        await update(userRef, { balance: newBalance });

        await set(gameRef, null);

        const resultEmbed = createSlotEmbed(
          finalSlotResults,
          bet,
          payoutMultiplier === -1 ? "lost" : "won",
          newBalance,
          winAmount,
        );

        await interaction.editReply({
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

    collector.on("end", async (_, reason) => {
      isCollectorActive = false;
      if (spinningInterval) clearInterval(spinningInterval);

      if (reason === "time") {
        try {
          await set(gameRef, null);
          await interaction.editReply({
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
    if (spinningInterval) clearInterval(spinningInterval);

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
