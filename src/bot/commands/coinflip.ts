import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { applyNetResult, STAKE_OPTION_NAME, stakeOption } from "./wager.js";
import {
  COIN_SIDE_LABELS,
  flip,
  resolve,
  type CoinSide,
} from "../../domain/coinflip.js";
import { assertValidStake } from "../../domain/economy.js";
import { wagerResultEmbed } from "../ui/embeds.js";
import { bold } from "../ui/format.js";

const SIDE_OPTION = "seite";

export const coinflipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Wirf eine Münze — richtig geraten verdoppelt den Einsatz")
    .addIntegerOption(stakeOption)
    .addStringOption((option) =>
      option
        .setName(SIDE_OPTION)
        .setDescription("Wähle eine Seite")
        .setRequired(true)
        .addChoices(
          { name: "Kopf", value: "heads" },
          { name: "Zahl", value: "tails" },
        ),
    ),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);
    const pick = interaction.options.getString(SIDE_OPTION, true) as CoinSide;

    const profile = await ctx.users.ensure(interaction.user.id);
    assertValidStake(stake, profile.balance);

    const outcome = resolve(flip(ctx.rng), pick, stake);
    const balance = await applyNetResult(
      ctx,
      interaction.user.id,
      stake,
      outcome.payout,
    );

    await interaction.reply({
      embeds: [
        wagerResultEmbed({
          title: "Coinflip",
          description: `Das Ergebnis war ${bold(COIN_SIDE_LABELS[outcome.result])}.`,
          won: outcome.won,
          balance,
        }),
      ],
    });
  },
};
