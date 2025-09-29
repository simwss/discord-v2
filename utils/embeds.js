import { EmbedBuilder } from "discord.js";
import { EMBED_COLORS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "./constants.js";

// Error Embeds
export function createErrorEmbed(title = "Fehler", description = ERROR_MESSAGES.GENERIC_ERROR) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(EMBED_COLORS.ERROR);
}

export function createInsufficientFundsEmbed(required, current) {
  return new EmbedBuilder()
    .setTitle("Fehler")
    .setDescription(
      `Du hast nicht genug Geld für diesen Einsatz.\n**Benötigt:** ${required.toLocaleString()}$\n**Dein Guthaben:** ${current.toLocaleString()}$`
    )
    .setColor(EMBED_COLORS.ERROR);
}

export function createInvalidBetEmbed() {
  return createErrorEmbed("Ungültiger Einsatz", ERROR_MESSAGES.INVALID_BET);
}

// Success Embeds
export function createSuccessEmbed(title, description, color = EMBED_COLORS.SUCCESS) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
}

export function createMinerPurchaseEmbed(minerName, cost, newBalance, minerCount) {
  return new EmbedBuilder()
    .setTitle(SUCCESS_MESSAGES.MINER_PURCHASED)
    .setDescription(`Du hast erfolgreich einen **${minerName}** für **${(cost / 1000000).toFixed(1)} Millionen Dollar** gekauft.`)
    .setColor(EMBED_COLORS.SUCCESS)
    .addFields(
      {
        name: "Kontostand",
        value: `${newBalance.toLocaleString()}$`,
        inline: true,
      },
      {
        name: minerName,
        value: `${minerCount}`,
        inline: true,
      }
    );
}

export function createResourceCollectionEmbed(earnings, newBalance, daysSince = 1) {
  return new EmbedBuilder()
    .setTitle(SUCCESS_MESSAGES.RESOURCES_COLLECTED)
    .setDescription(
      `Du hast **${earnings.toLocaleString()}$** von deinen Minern gesammelt.` +
      (daysSince > 1 ? ` (${daysSince} Tage gesammelt)` : "")
    )
    .setColor(EMBED_COLORS.SUCCESS)
    .addFields(
      {
        name: "Guthaben",
        value: `**${newBalance.toLocaleString()}$**`,
        inline: true,
      },
      {
        name: "Nächster Abbau",
        value: `<t:${Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)}:R>`,
        inline: true,
      }
    )
    .setTimestamp();
}

// Game Embeds
export function createGameEmbed(title, fields, color = EMBED_COLORS.INFO) {
  return new EmbedBuilder()
    .setTitle(title)
    .setFields(fields)
    .setColor(color);
}

export function createPlinkoballEmbed(board, bet, multiplier = null, payout = null, balance = null) {
  const fields = [
    {
      name: "Brett",
      value: `\`${board}\``,
    },
    {
      name: "Einsatz",
      value: `${bet}$`,
    }
  ];

  if (multiplier !== null) {
    fields.push({
      name: `${multiplier}x Multiplier`,
      value: `${payout}$ Payout`,
    });
  }

  if (balance !== null) {
    fields.push({
      name: "Kontostand",
      value: `${balance}$`,
    });
  }

  return createGameEmbed("Plinkoball", fields);
}

export function createSlotEmbed(symbols, bet, balance = null) {
  const fields = [
    {
      name: "Slot",
      value: symbols.join(" "),
    },
    {
      name: "Einsatz",
      value: `${bet}$`,
    }
  ];

  if (balance !== null) {
    fields.push({
      name: "Kontostand",
      value: `${balance}$`,
    });
  }

  return createGameEmbed("Slots", fields);
}

export function createRouletteEmbed(payouts, bet) {
  return createGameEmbed("Roulette", [
    {
      name: "Payout",
      value: `🟥Rot * **1** \n⬛Schwarz * **1**\n🟩Grün * **36**`,
    },
    {
      name: "Einsatz",
      value: `**${bet}**`,
    }
  ]);
}

// Leaderboard Embed
export function createLeaderboardEmbed(leaderboard) {
  return new EmbedBuilder()
    .setTitle("Leaderboard")
    .setDescription(leaderboard || "Keine Benutzer gefunden.")
    .setColor(EMBED_COLORS.NEUTRAL);
}

// Cooldown Embed
export function createCooldownEmbed(nextAvailableTime, workType) {
  return new EmbedBuilder()
    .setTitle("Cooldown aktiviert")
    .setDescription(`Du kannst deine ${workType} Belohnung am <t:${Math.floor(nextAvailableTime / 1000)}:F> wieder einsammeln.`)
    .setColor(EMBED_COLORS.WARNING);
}

// Mining Cooldown Embed
export function createMiningCooldownEmbed(nextMineTime) {
  return new EmbedBuilder()
    .setTitle("Cooldown aktiviert")
    .setDescription(`Du kannst erneut Ressourcen abbauen am <t:${Math.floor(nextMineTime / 1000)}:F>.`)
    .setColor(EMBED_COLORS.WARNING);
}

// No Miners Embed
export function createNoMinersEmbed() {
  return new EmbedBuilder()
    .setTitle("Keine Miner vorhanden")
    .setDescription("Du besitzt keine Miner. Kaufe Miner mit `/buy`")
    .setColor(EMBED_COLORS.ERROR);
}

// Profile Embed
export function createProfileEmbed(userData) {
  return new EmbedBuilder()
    .setTitle("Dein Profil")
    .setFields([
      {
        name: "Guthaben",
        value: `**${userData.balance.toLocaleString()}$**`,
      },
      {
        name: "Miner",
        value: `Basic Miners: **${userData.basicMiners || 0}**\nElite Miners: **${userData.eliteMiners || 0}**\nDeluxe Miner: **${userData.deluxeMiners || 0}**`,
      },
    ])
    .setColor(EMBED_COLORS.INFO);
}

// Vote Embed
export function createVoteEmbed(description, author, authorId) {
  return new EmbedBuilder()
    .setTitle("Abstimmung")
    .setDescription(description)
    .setAuthor({
      name: author,
      iconURL: `https://cdn.discordapp.com/avatars/${authorId}/avatar.png`,
      url: `https://discord.com/users/${authorId}`,
    })
    .addFields(
      { name: "Zugestimmt", value: "Niemand", inline: true },
      { name: "Abgelehnt", value: "Niemand", inline: true },
    )
    .setColor(EMBED_COLORS.INFO)
    .setTimestamp();
}

// Authorization Embed
export function createAuthEmbed(title, description, color = EMBED_COLORS.INFO) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
}
// Updated createSlotEmbed function (add this to your embeds.js)
export function createSlotEmbed(slotResults, bet, status, balance = null, winAmount = 0) {
  const slotDisplay = slotResults.length > 0 ? slotResults.join(" ") : "🎰 🎰 🎰";
  
  let title, color, description;
  
  switch (status) {
    case "spinning":
      title = "🎰 Slots - Dreht...";
      color = 0xFFFF00; // Yellow
      description = "Drücke **Stop** um die Walzen anzuhalten!";
      break;
    case "won":
      title = "🎰 Slots - Gewonnen! 🎉";
      color = 0x00FF00; // Green
      description = `**Gewinn: ${winAmount}$**`;
      break;
    case "lost":
      title = "🎰 Slots - Verloren 😔";
      color = 0xFF0000; // Red
      description = "Viel Glück beim nächsten Mal!";
      break;
    default:
      title = "🎰 Slots";
      color = 0x0099FF; // Blue
  }

  const embed = {
    title,
    color,
    description,
    fields: [
      {
        name: "Slot",
        value: slotDisplay,
        inline: false,
      },
      {
        name: "Einsatz",
        value: `${bet}$`,
        inline: true,
      },
    ],
    timestamp: new Date(),
  };

  if (balance !== null) {
    embed.fields.push({
      name: "Kontostand",
      value: `${balance}$`,
      inline: true,
    });
  }

  return embed;
}