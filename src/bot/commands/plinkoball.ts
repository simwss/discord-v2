import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { STAKE_OPTION_NAME, stakeOption, takeStake } from "./wager.js";
import { assertValidStake } from "../../domain/economy.js";
import { drop, payout, renderBoard } from "../../domain/plinko.js";
import { sleep } from "../../core/sleep.js";
import { plinkoEmbed } from "../ui/embeds.js";

const FRAME_DELAY_MS = 800;

export const plinkoballCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("plinkoball")
    .setDescription("Lass eine Kugel fallen und hoffe auf einen Multiplikator")
    .addIntegerOption(stakeOption),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);
    const userId = interaction.user.id;

    const profile = await ctx.users.ensure(userId);
    assertValidStake(stake, profile.balance);

    await takeStake(ctx, userId, stake);

    const result = drop(ctx.rng);
    const [firstPosition, ...restOfPath] = result.path;

    await interaction.reply({
      embeds: [
        plinkoEmbed({
          board: renderBoard(firstPosition ?? { row: 0, column: 0 }),
          stake,
        }),
      ],
    });

    for (const position of restOfPath) {
      await sleep(FRAME_DELAY_MS);
      await interaction.editReply({
        embeds: [plinkoEmbed({ board: renderBoard(position), stake })],
      });
    }

    const winnings = payout(result.multiplier, stake);
    const balance = await ctx.users.credit(userId, winnings);

    await interaction.editReply({
      embeds: [
        plinkoEmbed({
          board: renderBoard(
            result.path[result.path.length - 1] ?? { row: 0, column: 0 },
          ),
          stake,
          multiplier: result.multiplier,
          payout: winnings,
          balance,
        }),
      ],
    });
  },
};
