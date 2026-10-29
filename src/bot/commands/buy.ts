import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { MINERS } from "../../domain/miners.js";
import { MINER_TYPES, type MinerType } from "../../domain/user.js";
import { GameRuleError } from "../../core/errors.js";
import { minerPurchaseEmbed } from "../ui/embeds.js";
import { currency } from "../ui/format.js";

const TYPE_OPTION = "art";

function isMinerType(value: string): value is MinerType {
  return (MINER_TYPES as readonly string[]).includes(value);
}

export const buyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Kaufe einen Miner")
    .addStringOption((option) =>
      option
        .setName(TYPE_OPTION)
        .setDescription("Welche Art von Miner möchtest du kaufen?")
        .setRequired(true)
        .addChoices(
          ...MINER_TYPES.map((type) => ({
            name: `${MINERS[type].name} — ${currency(MINERS[type].cost)}`,
            value: type,
          })),
        ),
    ),

  async execute(interaction, ctx) {
    const type = interaction.options.getString(TYPE_OPTION, true);

    // Discord restricts the value to our choices, but an outdated client or a
    // stale command registration can still send something else.
    if (!isMinerType(type)) {
      throw new GameRuleError("Diesen Miner gibt es nicht.");
    }

    const miner = MINERS[type];
    const result = await ctx.users.purchaseMiner(interaction.user.id, type);

    if (!result.ok) {
      throw new GameRuleError(
        `Du hast nicht genug Geld. Ein ${miner.name} kostet ${currency(miner.cost)}.`,
      );
    }

    await interaction.reply({
      embeds: [
        minerPurchaseEmbed(miner, result.balance, result.owned, ctx.rng),
      ],
    });
  },
};
