import type { BotCommand } from "./types.js";
import { abstimmungCommand } from "./abstimmung.js";
import { authorisierenCommand } from "./authorisieren.js";
import { blackjackCommand } from "./blackjack.js";
import { buyCommand } from "./buy.js";
import { coinflipCommand } from "./coinflip.js";
import { collectCommand } from "./collect.js";
import { dicerollCommand } from "./diceroll.js";
import { leaderboardCommand } from "./leaderboard.js";
import { plinkoballCommand } from "./plinkoball.js";
import { profileCommand } from "./profile.js";
import { rouletteCommand } from "./roulette.js";
import { sellCommand } from "./sell.js";
import { sendCommand } from "./send.js";
import { slotsCommand } from "./slots.js";
import { dailyCommand, weeklyCommand, workCommand } from "./work.js";

/**
 * The single list of commands the bot implements. Both the runtime router and
 * the registration script read from it, so a command can never be registered
 * with Discord without a handler behind it.
 */
export const commands: readonly BotCommand[] = [
  abstimmungCommand,
  authorisierenCommand,
  blackjackCommand,
  buyCommand,
  coinflipCommand,
  collectCommand,
  dailyCommand,
  dicerollCommand,
  leaderboardCommand,
  plinkoballCommand,
  profileCommand,
  rouletteCommand,
  sellCommand,
  sendCommand,
  slotsCommand,
  weeklyCommand,
  workCommand,
];

export const commandsByName: ReadonlyMap<string, BotCommand> = new Map(
  commands.map((command) => [command.data.name, command]),
);

export type { BotCommand } from "./types.js";
