import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { GameRuleError } from "../../core/errors.js";
import { successEmbed } from "../ui/embeds.js";
import { bold, currency, mention } from "../ui/format.js";

const RECEIVER_OPTION = "nutzer";
const AMOUNT_OPTION = "betrag";

export const sendCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Schicke einem Nutzer Geld")
    .addUserOption((option) =>
      option
        .setName(RECEIVER_OPTION)
        .setDescription("Empfänger")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName(AMOUNT_OPTION)
        .setDescription("Wie viel willst du senden?")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction, ctx) {
    const receiver = interaction.options.getUser(RECEIVER_OPTION, true);
    const amount = interaction.options.getInteger(AMOUNT_OPTION, true);

    if (receiver.bot) {
      throw new GameRuleError("Bots können kein Geld empfangen.");
    }

    const result = await ctx.transfers.transfer(
      interaction.user.id,
      receiver.id,
      amount,
    );

    await interaction.reply({
      embeds: [
        successEmbed(
          "Transaktion erfolgreich",
          `Du hast ${bold(currency(result.amount))} an ${mention(receiver.id)} gesendet.`,
          [{ name: "Kontostand", value: bold(currency(result.senderBalance)) }],
        ),
      ],
      allowedMentions: { users: [receiver.id] },
    });
  },
};
