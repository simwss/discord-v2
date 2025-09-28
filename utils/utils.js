import { ref, get, set } from "firebase/database";
import { DEFAULT_USER_DATA, ERROR_MESSAGES } from "./constants.js";

export function validateBet(bet, userBalance, interaction) {
  if (bet <= 0) {
    interaction.reply({
      content: ERROR_MESSAGES.INVALID_BET,
      ephemeral: true,
    });
    return false;
  }
  
  if (bet > userBalance) {
    interaction.reply({
      content: ERROR_MESSAGES.INSUFFICIENT_FUNDS,
      ephemeral: true,
    });
    return false;
  }
  
  return true;
}

export function getRandomWorkMessage(amount) {
  const messages = [
    `Du hast ${amount}$ verdient! Gut gemacht!`,
    `${amount}$ für harte Arbeit - respektabel!`,
    `Dein Lohn: ${amount}$. Weiter so!`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function formatCurrency(amount) {
  return amount.toLocaleString() + "$";
}

export function ensureDateField(dateValue) {
  if (!dateValue || typeof dateValue !== 'number') {
    return 0;
  }
  return dateValue;
}

export function getDaysSinceLastMine(lastMineTimestamp) {
  const lastMine = ensureDateField(lastMineTimestamp);
  if (lastMine === 0) return 1;
  
  const now = Date.now();
  const millisInDay = 24 * 60 * 60 * 1000;
  const daysSince = Math.floor((now - lastMine) / millisInDay);
  
  return Math.max(1, daysSince);
}

export function isCooldownActive(lastTimestamp, cooldown) {
  const lastTime = ensureDateField(lastTimestamp);
  return lastTime > 0 && (Date.now() - lastTime) < cooldown;
}

export function getNextAvailableTime(lastTimestamp, cooldown) {
  return ensureDateField(lastTimestamp) + cooldown;
}

export async function ensureUserExists(db, userId, interaction) {
  const userRef = ref(db, `users/${userId}`);
  const userSnapshot = await get(userRef);
  
  if (!userSnapshot.exists()) {
    const defaultUserData = {
      id: userId,
      ...DEFAULT_USER_DATA
    };
    
    await set(userRef, defaultUserData);
    return defaultUserData;
  }
  
  return userSnapshot.val();
}