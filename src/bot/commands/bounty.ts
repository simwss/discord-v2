import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { GameRuleError } from "../../core/errors.js";
import { MAX_STAKE } from "../../domain/economy.js";
import { successEmbed } from "../ui/embeds.js";
import { bold, currency, mention } from "../ui/format.js";

const TARGET_OPTION = "nutzer";
const AMOUNT_OPTION = "betrag";

export const bountyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("bounty")
    .setDescription(
      "Setze ein Kopfgeld aus. Wer den Spieler ausraubt, bekommt es dazu",
    )
    .addUserOption((option) =>
      option
        .setName(TARGET_OPTION)
        .setDescription("Auf wen?")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName(AMOUNT_OPTION)
        .setDescription("Wie viel?")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_STAKE),
    ),

  async execute(interaction, ctx) {
    const target = interaction.options.getUser(TARGET_OPTION, true);
    const amount = interaction.options.getInteger(AMOUNT_OPTION, true);

    if (target.bot) {
      throw new GameRuleError("Bots kann man nicht ausrauben.");
    }
    if (target.id === interaction.user.id) {
      throw new GameRuleError(
        "Du kannst kein Kopfgeld auf dich selbst setzen.",
      );
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new GameRuleError("Der Betrag muss mindestens 1$ sein.");
    }

    const result = await ctx.users.placeBounty(
      interaction.user.id,
      target.id,
      amount,
    );

    if (!result.ok) {
      throw new GameRuleError(
        result.reason === "target_unknown"
          ? `${target.displayName} hat den Bot noch nie benutzt.`
          : "Du hast nicht genug Geld.",
      );
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          "Kopfgeld ausgesetzt",
          `Du hast ${bold(currency(amount))} auf ${mention(target.id)} ausgesetzt. Wer ${mention(target.id)} erfolgreich ausraubt, bekommt das Kopfgeld.`,
          [
            {
              name: "Kopfgeld gesamt",
              value: bold(currency(result.total)),
              inline: true,
            },
            {
              name: "Kontostand",
              value: bold(currency(result.balance)),
              inline: true,
            },
          ],
        ),
      ],
      allowedMentions: { users: [target.id] },
    });
  },
};
