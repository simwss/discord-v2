import { EmbedBuilder, type APIEmbedField } from "discord.js";
import { COLORS } from "./colors.js";
import {
  absoluteTime,
  bold,
  currency,
  duration,
  mention,
  mentionList,
  relativeTime,
} from "./format.js";
import {
  handValue,
  type BlackjackState,
  type Card,
} from "../../domain/blackjack.js";
import type { MinerDefinition } from "../../domain/miners.js";
import { MINERS, minerEmoji } from "../../domain/miners.js";
import { cryptoRng, type Rng } from "../../core/random.js";
import { MINER_TYPES, type UserProfile } from "../../domain/user.js";
import type { VoteTally } from "../../domain/vote.js";
import { ACHIEVEMENTS_BY_ID } from "../../domain/achievements.js";
import {
  LEADERBOARD_LABELS,
  type LeaderboardMetric,
} from "../../domain/leaderboard.js";
import type { Reels } from "../../domain/slots.js";

export const GENERIC_ERROR = "Ein unerwarteter Fehler ist aufgetreten.";

export function errorEmbed(
  description: string = GENERIC_ERROR,
  title = "Fehler",
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.ERROR);
}

export function successEmbed(
  title: string,
  description: string,
  fields: APIEmbedField[] = [],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.SUCCESS);
  return fields.length > 0 ? embed.addFields(fields) : embed;
}

export function cooldownEmbed(label: string, nextAt: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Cooldown aktiv")
    .setDescription(
      `Du kannst deine ${label} Belohnung ${relativeTime(nextAt)} wieder einsammeln (${absoluteTime(nextAt)}).`,
    )
    .setColor(COLORS.WARNING);
}

export function profileEmbed(
  profile: UserProfile,
  username: string,
  achievementIds: readonly string[] = [],
  rng: Rng = cryptoRng,
  bounty = 0,
): EmbedBuilder {
  const badges = achievementIds
    .map((id) => ACHIEVEMENTS_BY_ID.get(id)?.name)
    .filter((name): name is string => name !== undefined);

  const minerLines = MINER_TYPES.map(
    (type) =>
      `${minerEmoji(rng)} ${MINERS[type].name}: ${bold(String(profile.miners[type]))}`,
  ).join("\n");

  return new EmbedBuilder()
    .setTitle(`Profil von ${username}`)
    .setColor(COLORS.INFO)
    .addFields(
      { name: "Guthaben", value: bold(currency(profile.balance)) },
      { name: "Miner", value: minerLines },
      {
        name: "Daily-Streak",
        value: `${profile.dailyStreak} ${profile.dailyStreak === 1 ? "Tag" : "Tage"}`,
        inline: true,
      },
      {
        name: "Abzeichen",
        value: badges.length > 0 ? badges.join(" · ") : "Noch keine",
        inline: true,
      },
      ...(bounty > 0
        ? [{ name: "Kopfgeld", value: bold(currency(bounty)) }]
        : []),
    );
}

export interface LeaderboardEntry {
  readonly username: string;
  readonly value: number;
}

function formatLeaderboardValue(
  metric: LeaderboardMetric,
  value: number,
): string {
  switch (metric) {
    case "balance":
      return currency(value);
    case "miners":
      return `${value.toLocaleString("de-DE")} Miner`;
    case "yield":
      return `${currency(value)} pro Tag`;
  }
}

const PLACE_EMOJIS = ["🥇", "🥈", "🥉"] as const;

export function leaderboardEmbed(params: {
  metric: LeaderboardMetric;
  entries: readonly LeaderboardEntry[];
  /** Rank of the first entry minus one. */
  offset: number;
  page: number;
  pages: number;
}): EmbedBuilder {
  const body =
    params.entries.length === 0
      ? "Keine Spieler gefunden."
      : params.entries
          .map((entry, index) => {
            const rank = params.offset + index;
            const place = PLACE_EMOJIS[rank] ?? `**${rank + 1}.**`;
            return `${place} ${entry.username}: ${bold(formatLeaderboardValue(params.metric, entry.value))}`;
          })
          .join("\n");

  return new EmbedBuilder()
    .setTitle(`Leaderboard: ${LEADERBOARD_LABELS[params.metric]}`)
    .setDescription(body)
    .setColor(COLORS.NEUTRAL)
    .setFooter({ text: `Seite ${params.page + 1} von ${params.pages}` })
    .setTimestamp();
}

export function robEmbed(params: {
  victimId: string;
  outcome: "success" | "caught";
  amount: number;
  balance: number;
  bounty?: number;
}): EmbedBuilder {
  const victim = mention(params.victimId);
  const success = params.outcome === "success";
  const bounty = params.bounty ?? 0;
  const bountyText =
    success && bounty > 0
      ? `\nDazu kassierst du das Kopfgeld von ${bold(currency(bounty))}.`
      : "";

  return new EmbedBuilder()
    .setTitle(success ? "Raub geglückt" : "Erwischt")
    .setDescription(
      success
        ? `Du hast ${victim} ${bold(currency(params.amount))} abgenommen.${bountyText}`
        : `Du wurdest erwischt und musst ${victim} ${bold(currency(params.amount))} Strafe zahlen.`,
    )
    .setColor(success ? COLORS.SUCCESS : COLORS.ERROR)
    .addFields({
      name: "Kontostand",
      value: bold(currency(params.balance)),
    });
}

export function voteEmbed(params: {
  description: string;
  authorName: string;
  authorId: string;
  tally: VoteTally;
  closed?: boolean;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(params.closed === true ? "Abstimmung — Ergebnis" : "Abstimmung")
    .setDescription(params.description)
    .setAuthor({
      name: params.authorName,
      url: `https://discord.com/users/${params.authorId}`,
    })
    .addFields(
      {
        name: `Zugestimmt (${params.tally.accepted.length})`,
        value: mentionList(params.tally.accepted),
        inline: true,
      },
      {
        name: `Abgelehnt (${params.tally.declined.length})`,
        value: mentionList(params.tally.declined),
        inline: true,
      },
    )
    .setColor(params.closed === true ? COLORS.NEUTRAL : COLORS.INFO)
    .setTimestamp();
}

export function minerPurchaseEmbed(
  miner: MinerDefinition,
  balance: number,
  owned: number,
  rng: Rng = cryptoRng,
): EmbedBuilder {
  return successEmbed(
    "Miner gekauft",
    `Du hast einen ${minerEmoji(rng)} ${bold(miner.name)} für ${bold(currency(miner.cost))} gekauft.`,
    [
      { name: "Kontostand", value: bold(currency(balance)), inline: true },
      {
        name: `${minerEmoji(rng)} ${miner.name}`,
        value: bold(String(owned)),
        inline: true,
      },
    ],
  );
}

export function minerSaleEmbed(params: {
  miner: MinerDefinition;
  count: number;
  proceeds: number;
  balance: number;
  owned: number;
  rng?: Rng;
}): EmbedBuilder {
  const rng = params.rng ?? cryptoRng;
  return successEmbed(
    "Miner verkauft",
    `Du hast ${bold(`${params.count}× ${params.miner.name}`)} ${minerEmoji(rng)} für ${bold(currency(params.proceeds))} verkauft.`,
    [
      {
        name: "Kontostand",
        value: bold(currency(params.balance)),
        inline: true,
      },
      {
        name: `${minerEmoji(rng)} ${params.miner.name}`,
        value: bold(String(params.owned)),
        inline: true,
      },
    ],
  );
}

export function miningEmbed(
  amount: number,
  balance: number,
  elapsedMs: number,
  nextAt: number,
): EmbedBuilder {
  const span = ` (${duration(elapsedMs)})`;
  return successEmbed(
    "Ressourcen gesammelt",
    `Du hast ${bold(currency(amount))} von deinen Minern eingesammelt${span}.`,
    [
      { name: "Guthaben", value: bold(currency(balance)), inline: true },
      { name: "Nächster Abbau", value: relativeTime(nextAt), inline: true },
    ],
  ).setTimestamp();
}

export function noMinersEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Keine Miner vorhanden")
    .setDescription("Du besitzt keine Miner. Kaufe welche mit `/buy`.")
    .setColor(COLORS.WARNING);
}

/** Result embed shared by the one-shot wagering games. */
export function wagerResultEmbed(params: {
  title: string;
  description: string;
  won: boolean;
  balance: number;
  extraFields?: APIEmbedField[];
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(
      `${params.title} — Du hast ${params.won ? "gewonnen" : "verloren"}`,
    )
    .setDescription(params.description)
    .setColor(params.won ? COLORS.SUCCESS : COLORS.ERROR)
    .addFields(...(params.extraFields ?? []), {
      name: "Kontostand",
      value: bold(currency(params.balance)),
      inline: true,
    });
}

const RANK_LABELS: Readonly<Record<number, string>> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

export function formatCard(card: Card): string {
  return `${RANK_LABELS[card.rank] ?? String(card.rank)}${card.suit}`;
}

function formatHand(cards: readonly Card[]): string {
  return cards.map(formatCard).join(" ");
}

export function blackjackEmbed(
  state: BlackjackState,
  balance?: number,
): EmbedBuilder {
  const revealed = state.status === "finished";
  const [firstDealerCard] = state.dealer;

  const dealerValue = revealed
    ? handValue(state.dealer)
    : handValue(firstDealerCard ? [firstDealerCard] : []);
  const dealerHand = revealed
    ? formatHand(state.dealer)
    : `${firstDealerCard ? formatCard(firstDealerCard) : "?"} 🃏`;

  const embed = new EmbedBuilder()
    .setTitle(revealed ? `Blackjack — ${outcomeLabel(state)}` : "Blackjack")
    .setColor(outcomeColor(state))
    .addFields(
      { name: "Dealer", value: `(${dealerValue}) ${dealerHand}`, inline: true },
      {
        name: "Spieler",
        value: `(${handValue(state.player)}) ${formatHand(state.player)}`,
        inline: true,
      },
      { name: "Einsatz", value: bold(currency(state.stake)), inline: false },
    );

  if (balance !== undefined) {
    embed.addFields({ name: "Kontostand", value: bold(currency(balance)) });
  }
  return embed;
}

function outcomeLabel(state: BlackjackState): string {
  switch (state.outcome) {
    case "natural":
      return "Blackjack! 🎉";
    case "won":
      return "Du hast gewonnen";
    case "push":
      return "Unentschieden";
    case "lost":
      return "Du hast verloren";
    case null:
      return "Beendet";
  }
}

function outcomeColor(state: BlackjackState): number {
  switch (state.outcome) {
    case "natural":
    case "won":
      return COLORS.SUCCESS;
    case "lost":
      return COLORS.ERROR;
    case "push":
      return COLORS.WARNING;
    case null:
      return COLORS.INFO;
  }
}

export function rouletteEmbed(stake: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Roulette")
    .setColor(COLORS.INFO)
    .addFields(
      {
        name: "Auszahlung",
        value: "🟥 Rot ×2\n⬛ Schwarz ×2\n🟩 Grün ×37",
      },
      { name: "Einsatz", value: bold(currency(stake)) },
    );
}

export function slotsEmbed(params: {
  reels: Reels | null;
  stake: number;
  status: "spinning" | "won" | "lost";
  balance?: number;
  winnings?: number;
}): EmbedBuilder {
  const display = params.reels ? params.reels.join(" ") : "🎰 🎰 🎰";

  const presentation = {
    spinning: {
      title: "🎰 Slots — dreht...",
      color: COLORS.SPINNING,
      description: "Die Walzen laufen!",
    },
    won: {
      title: "🎰 Slots — gewonnen! 🎉",
      color: COLORS.SUCCESS,
      description: `Auszahlung: ${bold(currency(params.winnings ?? 0))}`,
    },
    lost: {
      title: "🎰 Slots — verloren 😔",
      color: COLORS.ERROR,
      description: "Viel Glück beim nächsten Mal!",
    },
  }[params.status];

  const embed = new EmbedBuilder()
    .setTitle(presentation.title)
    .setDescription(presentation.description)
    .setColor(presentation.color)
    .addFields(
      { name: "Walzen", value: display },
      { name: "Einsatz", value: bold(currency(params.stake)), inline: true },
    );

  if (params.balance !== undefined) {
    embed.addFields({
      name: "Kontostand",
      value: bold(currency(params.balance)),
      inline: true,
    });
  }
  return embed;
}

export function plinkoEmbed(params: {
  board: string;
  stake: number;
  multiplier?: number;
  payout?: number;
  balance?: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Plinkoball")
    .setColor(COLORS.INFO)
    .addFields(
      { name: "Brett", value: `\`\`\`\n${params.board}\n\`\`\`` },
      { name: "Einsatz", value: bold(currency(params.stake)), inline: true },
    );

  if (params.multiplier !== undefined) {
    embed.addFields({
      name: `${params.multiplier}× Multiplikator`,
      value: bold(currency(params.payout ?? 0)),
      inline: true,
    });
    embed.setColor(
      (params.payout ?? 0) >= params.stake ? COLORS.SUCCESS : COLORS.ERROR,
    );
  }

  if (params.balance !== undefined) {
    embed.addFields({
      name: "Kontostand",
      value: bold(currency(params.balance)),
    });
  }
  return embed;
}
