import { ref, get, update } from "firebase/database";
import { ensureUserExists, getDaysSinceLastMine, isCooldownActive, getNextAvailableTime } from "../utils/utils.js";
import { miners } from "../utils/miners.js";
import { GAME_CONFIG } from "../utils/constants.js";
import { createMiningCooldownEmbed, createResourceCollectionEmbed, createNoMinersEmbed, createErrorEmbed } from "../utils/embeds.js";

export async function handleCollect(interaction, db, currentUserId) {
  const userRef = ref(db, `users/${currentUserId}`);
  const millisInDay = GAME_CONFIG.MINING.COOLDOWN;
  
  try {
    const userData = await ensureUserExists(db, currentUserId, interaction);
    
    const lastMineTime = userData.lastMine || 0;
    if (isCooldownActive(lastMineTime, millisInDay)) {
      const nextMineTime = getNextAvailableTime(lastMineTime, millisInDay);
      return await interaction.reply({ embeds: [createMiningCooldownEmbed(nextMineTime)] });
    }

    const daysSinceLastMine = getDaysSinceLastMine(lastMineTime);
    let totalEarnings =
      (userData.basicMiners || 0) * miners.basic.dailyEarnings +
      (userData.eliteMiners || 0) * miners.elite.dailyEarnings +
      (userData.deluxeMiners || 0) * miners.deluxe.dailyEarnings;
    
    totalEarnings *= daysSinceLastMine;

    if (totalEarnings === 0) {
      return await interaction.reply({ embeds: [createNoMinersEmbed()], ephemeral: true });
    }

    const updates = {
      balance: userData.balance + totalEarnings,
      lastMine: Date.now(),
    };

    await update(userRef, updates);

    await interaction.reply({ 
      embeds: [createResourceCollectionEmbed(totalEarnings, userData.balance + totalEarnings, daysSinceLastMine)] 
    });
  } catch (error) {
    console.error("Error in collect command:", error);
    
    if (!interaction.replied) {
      await interaction.reply({ 
        embeds: [createErrorEmbed()], 
        ephemeral: true 
      });
    }
  }
}