import { handleAuthorisieren } from "./commands/authorisieren.js";
import { handleAbstimmung } from "./commands/abstimmung.js";
import { handleCoinflip } from "./commands/gambleCommands.js";
import { handleDiceroll } from "./commands/gambleCommands.js";
import { handleBlackjack } from "./commands/blackjack.js";
import { handleProfile } from "./commands/profile.js";
import { handleLeaderboard } from "./commands/leaderboard.js";
import { handleWork, handleDaily, handleWeekly } from "./commands/workCommands.js";
import { handleRoulette } from "./commands/roulette.js";
import { handleSend } from "./commands/send.js";
import { handleBuy } from "./commands/buy.js";
import { handleDrink } from "./commands/drink.js";
import { handleCollect } from "./commands/collect.js";
import { handlePlinkoball } from "./commands/plinkoball.js";
import { handleSlots } from "./commands/slots.js";
import { ensureUserExists } from "../utils/utils.js";
import { BANNED_USERS } from "../utils/constants.js";

const COMMANDS_MAP = new Map([
  ["authorisieren", handleAuthorisieren],
  ["abstimmung", handleAbstimmung],
  ["coinflip", handleCoinflip],
  ["diceroll", handleDiceroll],
  ["blackjack", handleBlackjack],
  ["profile", handleProfile],
  ["leaderboard", handleLeaderboard],
  ["work", handleWork],
  ["weekly", handleWeekly],
  ["daily", handleDaily],
  ["roulette", handleRoulette],
  ["send", handleSend],
  ["buy", handleBuy],
  ["drink", handleDrink],
  ["collect", handleCollect],
  ["plinkoball", handlePlinkoball],
  ["slots", handleSlots],
]);

export async function handleCommand(interaction, db, currentUserId) {
  if (BANNED_USERS.includes(currentUserId)) {
    await interaction.reply({
      content: "Hier ist kein Platz für Unterstützer eines Klassensystems",
      ephemeral: true,
    });
    return;
  }

  const commandName = interaction.commandName;
  const commandHandler = COMMANDS_MAP.get(commandName);

  if (commandHandler) {
    await ensureUserExists(db, currentUserId, interaction);
    await commandHandler(interaction, db, currentUserId);
  } else {
    console.error(`Unknown command: ${commandName}`);
    await interaction.reply({
      content: "Unbekannter Befehl.",
      ephemeral: true,
    });
  }
}