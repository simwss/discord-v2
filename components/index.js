import { handleVoteYesNo } from "./voteYesNo.js";
import { handleVoteEnd } from "./voteEnd.js";
import { handleBlackjackHitStand } from "./blackJackHitStand.js";
import { handleRoulette } from "./rouletteInteraction.js";
import { createErrorEmbed } from "../utils/embeds.js";
import { ERROR_MESSAGES } from "../utils/constants.js";

export async function handleComponent(interaction, db, currentUserId) {
  const componentId = interaction.customId;

  const componentHandlers = new Map([
    ["vote_yes", handleVoteYesNo],
    ["vote_no", handleVoteYesNo],
    ["vote_end", handleVoteEnd],
    ["blackjack", handleBlackjackHitStand],
    ["roulette", handleRoulette],
    ["slots", () => {}],
  ]);

  let handler = null;

  for (let [prefix, func] of componentHandlers) {
    if (componentId.startsWith(prefix)) {
      handler = func;
      break;
    }
  }

  try {
    if (handler) {
      await handler(interaction, db, currentUserId, componentId);
    } else {
      console.error(`Unknown component: ${componentId}`);
      await interaction.reply({
        embeds: [createErrorEmbed("Fehler", "Unbekannte Interaktion.")],
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error(`Error handling component ${componentId}:`, error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [createErrorEmbed()],
        ephemeral: true,
      });
    }
  }
}
