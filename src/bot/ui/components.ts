import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { encodeCustomId } from "../custom-id.js";
import { ROULETTE_COLORS, type RouletteColor } from "../../domain/roulette.js";

export const BLACKJACK_NAMESPACE = "bj";
export const ROULETTE_NAMESPACE = "rl";
export const VOTE_NAMESPACE = "vote";

export function blackjackButtons(
  userId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId(BLACKJACK_NAMESPACE, "hit", userId))
      .setLabel("Hit")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeCustomId(BLACKJACK_NAMESPACE, "stand", userId))
      .setLabel("Stand")
      .setStyle(ButtonStyle.Danger),
  );
}

const ROULETTE_BUTTON_STYLE: Record<RouletteColor, ButtonStyle> = {
  red: ButtonStyle.Danger,
  black: ButtonStyle.Secondary,
  green: ButtonStyle.Success,
};

const ROULETTE_BUTTON_LABEL: Record<RouletteColor, string> = {
  red: "🟥 Rot",
  black: "⬛ Schwarz",
  green: "🟩 Grün",
};

export function rouletteButtons(
  userId: string,
  stake: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...ROULETTE_COLORS.map((color) =>
      new ButtonBuilder()
        .setCustomId(encodeCustomId(ROULETTE_NAMESPACE, color, userId, stake))
        .setLabel(ROULETTE_BUTTON_LABEL[color])
        .setStyle(ROULETTE_BUTTON_STYLE[color]),
    ),
  );
}

export function voteButtons(voteId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeCustomId(VOTE_NAMESPACE, "yes", voteId))
      .setLabel("Zustimmen")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(encodeCustomId(VOTE_NAMESPACE, "no", voteId))
      .setLabel("Ablehnen")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(encodeCustomId(VOTE_NAMESPACE, "end", voteId))
      .setLabel("Beenden")
      .setStyle(ButtonStyle.Primary),
  );
}
