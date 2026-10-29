import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { GameRuleError } from "../../core/errors.js";
import {
  MIN_ROBBER_BALANCE,
  MIN_VICTIM_BALANCE,
  resolveRob,
  ROB_COOLDOWN_MS,
} from "../../domain/rob.js";
import { cooldownEmbed, robEmbed } from "../ui/embeds.js";
import { currency } from "../ui/format.js";

const VICTIM_OPTION = "nutzer";

export const robCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Versuche, einem anderen Spieler Geld zu stehlen")
    .addUserOption((option) =>
      option
        .setName(VICTIM_OPTION)
        .setDescription("Wen willst du ausrauben?")
        .setRequired(true),
    ),

  async execute(interaction, ctx) {
    const victim = interaction.options.getUser(VICTIM_OPTION, true);

    if (victim.bot) {
      throw new GameRuleError("Bots haben kein Geld.");
    }
    if (victim.id === interaction.user.id) {
      throw new GameRuleError("Du kannst dich nicht selbst ausrauben.");
    }

    const result = await ctx.users.rob({
      robberId: interaction.user.id,
      victimId: victim.id,
      cooldownMs: ROB_COOLDOWN_MS,
      now: ctx.clock.now(),
      decide: (robberBalance, victimBalance) =>
        resolveRob(ctx.rng, robberBalance, victimBalance),
    });

    if (!result.ok) {
      switch (result.reason) {
        case "cooldown":
          await interaction.reply({
            embeds: [cooldownEmbed("Raub-", result.nextAt)],
          });
          return;
        case "victim_unknown":
          throw new GameRuleError(
            `${victim.displayName} hat den Bot noch nie benutzt.`,
          );
        case "victim_poor":
          throw new GameRuleError(
            `Bei ${victim.displayName} gibt es nichts zu holen. Man braucht mindestens ${currency(MIN_VICTIM_BALANCE)} auf dem Konto.`,
          );
        case "robber_poor":
          throw new GameRuleError(
            `Du brauchst mindestens ${currency(MIN_ROBBER_BALANCE)}, um eine mögliche Strafe zahlen zu können.`,
          );
      }
    }

    const { decision } = result;
    await interaction.reply({
      embeds: [
        robEmbed({
          victimId: victim.id,
          outcome: decision.kind,
          amount: decision.kind === "success" ? decision.amount : decision.fine,
          balance: result.robberBalance,
        }),
      ],
      allowedMentions: { users: [victim.id] },
    });
  },
};
