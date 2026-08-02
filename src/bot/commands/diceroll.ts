import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { applyNetResult, STAKE_OPTION_NAME, stakeOption } from "./wager.js";
import {
  DIE_FACES,
  isDieFace,
  resolve,
  roll,
  type DieFace,
} from "../../domain/diceroll.js";
import { assertValidStake } from "../../domain/economy.js";
import { GameRuleError } from "../../core/errors.js";
import { wagerResultEmbed } from "../ui/embeds.js";
import { bold } from "../ui/format.js";

const FACE_OPTION = "zahl";

export const dicerollCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("diceroll")
    .setDescription("Wähle eine Augenzahl und gewinne das Sechsfache")
    .addIntegerOption(stakeOption)
    .addIntegerOption((option) =>
      option
        .setName(FACE_OPTION)
        .setDescription("Auf welche Augenzahl wettest du?")
        .setRequired(true)
        .addChoices(
          ...DIE_FACES.map((face) => ({ name: String(face), value: face })),
        ),
    ),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);
    const pickRaw = interaction.options.getInteger(FACE_OPTION, true);

    if (!isDieFace(pickRaw)) {
      throw new GameRuleError("Wähle eine Augenzahl zwischen 1 und 6.");
    }
    const pick: DieFace = pickRaw;

    const profile = await ctx.users.ensure(interaction.user.id);
    assertValidStake(stake, profile.balance);

    const outcome = resolve(roll(ctx.rng), pick, stake);
    const balance = await applyNetResult(
      ctx,
      interaction.user.id,
      stake,
      outcome.payout,
    );

    await interaction.reply({
      embeds: [
        wagerResultEmbed({
          title: "Diceroll",
          description: `Gewürfelt wurde eine ${bold(String(outcome.result))}.`,
          won: outcome.won,
          balance,
        }),
      ],
    });
  },
};
