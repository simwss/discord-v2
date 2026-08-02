import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { STAKE_OPTION_NAME, stakeOption, takeStake } from "./wager.js";
import { assertValidStake } from "../../domain/economy.js";
import { evaluate, spin } from "../../domain/slots.js";
import { sleep } from "../../core/sleep.js";
import { slotsEmbed } from "../ui/embeds.js";

const SPIN_FRAMES = 3;
const FRAME_DELAY_MS = 700;

export const slotsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Spiele an den Slots")
    .addIntegerOption(stakeOption),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);
    const userId = interaction.user.id;

    const profile = await ctx.users.ensure(userId);
    assertValidStake(stake, profile.balance);

    // Commit the stake before the animation so a second /slots cannot be
    // funded by money this spin has already claimed.
    await takeStake(ctx, userId, stake);

    // The outcome is drawn up front and the animation only shows filler.
    // In v1 the reels on screen *were* the result and a "Stop" button locked
    // them in, so a player could simply wait for three matching symbols and
    // press Stop — a guaranteed win.
    const reels = spin(ctx.rng);
    const result = evaluate(reels, stake);

    await interaction.reply({
      embeds: [slotsEmbed({ reels: spin(ctx.rng), stake, status: "spinning" })],
    });

    for (let frame = 1; frame < SPIN_FRAMES; frame++) {
      await sleep(FRAME_DELAY_MS);
      await interaction.editReply({
        embeds: [
          slotsEmbed({ reels: spin(ctx.rng), stake, status: "spinning" }),
        ],
      });
    }

    await sleep(FRAME_DELAY_MS);
    const balance = await ctx.users.credit(userId, result.payout);

    await interaction.editReply({
      embeds: [
        slotsEmbed({
          reels: result.reels,
          stake,
          status: result.won ? "won" : "lost",
          balance,
          winnings: result.payout,
        }),
      ],
    });
  },
};
