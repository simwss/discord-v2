import { ref, get, set } from "firebase/database";
import { ensureUserExists, isCooldownActive, getNextAvailableTime, getRandomWorkMessage } from "../utils/utils.js";
import { GAME_CONFIG } from "../utils/constants.js";
import { createCooldownEmbed, createErrorEmbed } from "../utils/embeds.js";

const WORK_CONFIG = GAME_CONFIG.WORK;

async function handleWorkCommand(interaction, db, currentUserId, workType) {
  const config = WORK_CONFIG[workType];
  
  try {
    const userRef = ref(db, `users/${currentUserId}`);
    const userData = await ensureUserExists(db, currentUserId, interaction);
    
    if (isCooldownActive(userData[config.timestampField], config.cooldown)) {
      const nextAvailableTime = getNextAvailableTime(userData[config.timestampField], config.cooldown);
      await interaction.reply({
        embeds: [createCooldownEmbed(nextAvailableTime, config.name)],
        ephemeral: true,
      });
      return;
    }

    const amount = typeof config.amount === 'function' ? config.amount() : config.amount;
    const updates = {
      balance: userData.balance + amount,
      [config.timestampField]: Date.now()
    };

    await set(userRef, { ...userData, ...updates });

    const message = getWorkMessage(workType, amount);
    await interaction.reply({
      content: message,
      ephemeral: false,
    });
  } catch (error) {
    console.error(`Error handling ${workType} work command:`, error);
    
    if (!interaction.replied) {
      await interaction.reply({
        embeds: [createErrorEmbed()],
        ephemeral: true,
      });
    }
  }
}

function getWorkMessage(workType, amount) {
  const messages = {
    HOURLY: getRandomWorkMessage(amount),
    DAILY: `Du erhältst ${amount}$ vom Staat (dafür hat sich die **PAS** eingesetzt)`,
    WEEKLY: `Du erhälst ${amount}$ von der **PAS** geschenkt (einfach so, weil die cool sind).`
  };
  return messages[workType];
}

export async function handleWork(interaction, db, currentUserId) {
  await handleWorkCommand(interaction, db, currentUserId, 'HOURLY');
}

export async function handleDaily(interaction, db, currentUserId) {
  await handleWorkCommand(interaction, db, currentUserId, 'DAILY');
}

export async function handleWeekly(interaction, db, currentUserId) {
  await handleWorkCommand(interaction, db, currentUserId, 'WEEKLY');
}