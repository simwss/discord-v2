import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { STAKE_OPTION_NAME, stakeOption } from "./wager.js";
import { assertValidStake } from "../../domain/economy.js";
import { rouletteEmbed } from "../ui/embeds.js";
import { rouletteButtons } from "../ui/components.js";

export const rouletteCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Spiele eine Runde Roulette")
    .addIntegerOption(stakeOption),

  async execute(interaction, ctx) {
    const stake = interaction.options.getInteger(STAKE_OPTION_NAME, true);

    const profile = await ctx.users.ensure(interaction.user.id);
    assertValidStake(stake, profile.balance);

    // The stake is only taken when a colour is chosen: the wheel spins on the
    // button press, and both legs settle in one transaction there.
    await interaction.reply({
      embeds: [rouletteEmbed(stake)],
      components: [rouletteButtons(interaction.user.id, stake)],
    });
  },
};
