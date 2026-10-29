import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { MINERS, sellPrice } from "../../domain/miners.js";
import { MINER_TYPES, type MinerType } from "../../domain/user.js";
import { GameRuleError } from "../../core/errors.js";
import { minerSaleEmbed } from "../ui/embeds.js";
import { currency } from "../ui/format.js";

const TYPE_OPTION = "art";
const AMOUNT_OPTION = "menge";

function isMinerType(value: string): value is MinerType {
  return (MINER_TYPES as readonly string[]).includes(value);
}

export const sellCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Verkaufe Miner für die Hälfte ihres Preises")
    .addStringOption((option) =>
      option
        .setName(TYPE_OPTION)
        .setDescription("Welche Art von Miner möchtest du verkaufen?")
        .setRequired(true)
        .addChoices(
          ...MINER_TYPES.map((type) => ({
            name: `${MINERS[type].name} — ${currency(sellPrice(type))} pro Stück`,
            value: type,
          })),
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName(AMOUNT_OPTION)
        .setDescription("Wie viele Miner möchtest du verkaufen?")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction, ctx) {
    const type = interaction.options.getString(TYPE_OPTION, true);
    const count = interaction.options.getInteger(AMOUNT_OPTION, true);

    // Discord enforces both constraints, but a stale command registration can
    // still send values outside them.
    if (!isMinerType(type)) {
      throw new GameRuleError("Diesen Miner gibt es nicht.");
    }
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new GameRuleError("Die Menge muss mindestens 1 sein.");
    }

    const miner = MINERS[type];
    const result = await ctx.users.sellMiners(interaction.user.id, type, count);

    if (!result.ok) {
      throw new GameRuleError(
        `Du besitzt nur ${result.owned}× ${miner.name} und kannst daher keine ${count} verkaufen.`,
      );
    }

    await interaction.reply({
      embeds: [
        minerSaleEmbed({
          miner,
          count,
          proceeds: result.proceeds,
          balance: result.balance,
          owned: result.owned,
          rng: ctx.rng,
        }),
      ],
    });
  },
};
