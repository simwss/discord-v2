import type { ComponentHandler } from "./types.js";
import { GameRuleError, UserFacingError } from "../../core/errors.js";
import {
  ROULETTE_COLORS,
  colorOf,
  resolve,
  spin,
  type RouletteColor,
} from "../../domain/roulette.js";
import { wagerResultEmbed } from "../ui/embeds.js";
import { bold } from "../ui/format.js";
import { ROULETTE_NAMESPACE } from "../ui/components.js";
import { updateMessage } from "../reply.js";

const COLOR_LABEL: Readonly<Record<RouletteColor, string>> = {
  red: "Rot 🟥",
  black: "Schwarz ⬛",
  green: "Grün 🟩",
};

function isRouletteColor(value: string): value is RouletteColor {
  return (ROULETTE_COLORS as readonly string[]).includes(value);
}

export const rouletteComponent: ComponentHandler = {
  namespace: ROULETTE_NAMESPACE,

  async handle(interaction, ctx, id) {
    const [ownerId, rawStake] = id.args;

    if (ownerId !== interaction.user.id) {
      throw new UserFacingError("Das ist nicht dein Spiel.");
    }
    if (!isRouletteColor(id.action)) {
      throw new GameRuleError("Unbekannte Farbe.");
    }

    const stake = Number(rawStake);
    if (!Number.isInteger(stake) || stake <= 0) {
      throw new GameRuleError("Ungültiger Einsatz.");
    }

    const result = resolve(spin(ctx.rng), id.action, stake);

    // Stake and payout settle together, so the balance can never go negative
    // and a lost spin cannot be replayed for a second payout.
    const balance = await ctx.users.adjustBalance(
      interaction.user.id,
      result.payout - stake,
    );
    if (!balance.ok) {
      throw new GameRuleError("Du hast nicht genug Geld für diesen Einsatz.");
    }

    await updateMessage(interaction, {
      embeds: [
        wagerResultEmbed({
          title: "Roulette",
          description: `Die Kugel landet auf ${bold(String(result.pocket))} — ${COLOR_LABEL[colorOf(result.pocket)]}`,
          won: result.won,
          balance: balance.balance,
        }),
      ],
      components: [],
    });
  },
};
