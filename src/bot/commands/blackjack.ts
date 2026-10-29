import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { STAKE_OPTION_NAME, stakeOption, takeStake } from "./wager.js";
import { assertValidStake } from "../../domain/economy.js";
import { isNatural, payout, stand, startGame } from "../../domain/blackjack.js";
import { GameRuleError } from "../../core/errors.js";
import { blackjackEmbed } from "../ui/embeds.js";
import { blackjackButtons } from "../ui/components.js";

export const blackjackCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Spiele eine Hand Blackjack")
    .addIntegerOption(stakeOption),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);
    const userId = interaction.user.id;

    // v1 overwrote an in-progress hand, which silently forfeited its stake.
    const existing = await ctx.blackjack.find(userId);
    if (existing?.status === "playing") {
      throw new GameRuleError(
        "Du hast bereits eine laufende Hand. Beende sie zuerst.",
      );
    }

    const profile = await ctx.users.ensure(userId);
    assertValidStake(stake, profile.balance);

    await takeStake(ctx, userId, stake);

    const game = startGame(stake, ctx.rng);

    // A natural pays out immediately; there is nothing left to decide.
    if (isNatural(game.player)) {
      const settled = stand(game);
      const outcome = settled.outcome ?? "lost";
      const balance = await ctx.users.credit(userId, payout(outcome, stake));
      await ctx.blackjack.clear(userId);
      await ctx.users.recordBlackjackOutcome(userId, outcome);
      await interaction.reply({ embeds: [blackjackEmbed(settled, balance)] });
      return;
    }

    await ctx.blackjack.save(userId, game);

    await interaction.reply({
      embeds: [blackjackEmbed(game)],
      components: [blackjackButtons(userId)],
    });
  },
};
