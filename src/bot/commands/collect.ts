import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import {
  computeMiningYield,
  dailyYield,
  MINING_COOLDOWN_MS,
  type MiningResult,
} from "../../domain/miners.js";
import { cooldownEmbed, miningEmbed, noMinersEmbed } from "../ui/embeds.js";
import { respondEphemeral } from "../reply.js";

export const collectCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("collect")
    .setDescription("Sammle die Erträge deiner Miner ein"),

  async execute(interaction, ctx) {
    const userId = interaction.user.id;
    const profile = await ctx.users.ensure(userId);

    if (dailyYield(profile.miners) === 0) {
      await respondEphemeral(interaction, { embeds: [noMinersEmbed()] });
      return;
    }

    const now = ctx.clock.now();
    let credited: MiningResult | undefined;
    const result = await ctx.users.claimMining({
      userId,
      cooldownMs: MINING_COOLDOWN_MS,
      now,
      // Evaluated inside the transaction against the committed record, so a
      // duplicate command cannot be credited for the same elapsed time.
      computeAmount: (current) => {
        credited = computeMiningYield(current, now);
        return credited.amount;
      },
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [cooldownEmbed("Miner-", result.nextAt)],
      });
      return;
    }

    await interaction.reply({
      embeds: [
        miningEmbed(
          result.amount,
          result.balance,
          credited?.elapsedMs ?? 0,
          now + MINING_COOLDOWN_MS,
        ),
      ],
    });
  },
};
