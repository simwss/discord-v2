// Game Configuration
export const GAME_CONFIG = {
  // Work rewards and cooldowns
  WORK: {
    HOURLY: {
      amount: () => Math.floor(Math.random() * 100) + 900,
      cooldown: 3600000, // 1 hour
      timestampField: 'hourlyWorkTimestamp',
      name: "stündlich"
    },
    DAILY: {
      amount: 5000,
      cooldown: 3600000 * 24, // 24 hours
      timestampField: 'dailyWorkTimestamp',
      name: "täglich"
    },
    WEEKLY: {
      amount: 100000,
      cooldown: 3600000 * 24 * 7, // 7 days
      timestampField: 'weeklyWorkTimestamp',
      name: "wöchentlich"
    }
  },

  // Mining cooldowns
  MINING: {
    COOLDOWN: 3600000 * 24, // 24 hours
    TIMESTAMP_FIELD: 'lastMine'
  },

  // Plinkoball multipliers
  PLINKOBALL_MULTIPLIERS: [4, 2, 2, 0, 0, 2, 2, 4],

  // Roulette numbers
  ROULETTE: {
    RED_NUMBERS: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
    BLACK_NUMBERS: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
  },

  // Slot machine symbols and payouts
  SLOTS: {
    SYMBOLS: ["🍒", "🍋", "🔔"],
    PAYOUTS: {
      "🍒": 2,
      "🍋": 3,
      "🔔": 5
    }
  },

  // Leaderboard settings
  LEADERBOARD: {
    MAX_ENTRIES: 10,
    PLACE_EMOJIS: {
      0: "🥇",
      1: "🥈", 
      2: "🥉"
    }
  }
};

// Embed Colors
export const EMBED_COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  WARNING: 0xffa500,
  INFO: 0x0099ff,
  NEUTRAL: 0x00ae86
};

// Default User Data
export const DEFAULT_USER_DATA = {
  balance: 1000,
  dailyWorkTimestamp: 0,
  weeklyWorkTimestamp: 0,
  hourlyWorkTimestamp: 0,
  lastMine: 0,
  authorised: false,
  basicMiners: 0,
  eliteMiners: 0,
  deluxeMiners: 0,
};

// Error Messages
export const ERROR_MESSAGES = {
  INSUFFICIENT_FUNDS: "Du hast nicht genug Geld für diesen Einsatz.",
  INVALID_BET: "Der Einsatz muss größer als 0 sein.",
  USER_NOT_FOUND: "Dein Profil konnte nicht gefunden werden.",
  NOT_YOUR_GAME: "Das ist nicht dein Spiel.",
  GENERIC_ERROR: "Ein unerwarteter Fehler ist aufgetreten.",
  COMMAND_ERROR: "Es gab einen Fehler beim Ausführen des Befehls.",
  RECEIVER_NOT_REGISTERED: "Der Empfänger ist nicht registriert",
  NEGATIVE_AMOUNT: "Du kannst keinen negativen Betrag verschicken",
  NOT_ENOUGH_MONEY: "Du hast nicht genug Geld"
};

// Success Messages
export const SUCCESS_MESSAGES = {
  MINER_PURCHASED: "Miner gekauft!",
  RESOURCES_COLLECTED: "Ressourcen gesammelt!",
  TRANSACTION_SUCCESS: "Transaktion erfolgreich"
};

// Banned Users
export const BANNED_USERS = [
  "688129442156904475",
  "446339247637790721", 
  "763433160712519680",
  "399559740428124160",
  "371261706460069888",
  "464467958148759602",
];
