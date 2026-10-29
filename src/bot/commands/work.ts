import { SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "./types.js";
import { WORK } from "../../domain/economy.js";
import type { WorkKind } from "../../domain/user.js";
import { cooldownEmbed, successEmbed } from "../ui/embeds.js";
import { bold, currency } from "../ui/format.js";
import type { Rng } from "../../core/random.js";

const DESCRIPTIONS: Readonly<Record<WorkKind, string>> = {
  hourly: "Geh arbeiten und verdiene stündlich Geld",
  daily: "Hole dir deine tägliche Unterstützung ab",
  weekly: "Hole dir dein wöchentliches Geschenk ab",
};

const COMMAND_NAMES: Readonly<Record<WorkKind, string>> = {
  hourly: "work",
  daily: "daily",
  weekly: "weekly",
};

function successMessage(kind: WorkKind, amount: number, rng: Rng): string {
  const money = bold(currency(amount));

  if (kind === "daily") {
    return `Du erhältst ${money} vom Staat (dafür hat sich die ${bold("PAS")} eingesetzt).`;
  }
  if (kind === "weekly") {
    return `Du erhältst ${money} von der ${bold("PAS")} geschenkt (einfach so, weil die cool sind).`;
  }

  return rng.pick([
    `Du hast ${money} verdient. Gut gemacht!`,
    `${money} für harte Arbeit — respektabel!`,
    `Dein Lohn: ${money}. Weiter so!`,
  ]);
}

function createWorkCommand(kind: WorkKind): BotCommand {
  const definition = WORK[kind];

  return {
    data: new SlashCommandBuilder()
      .setName(COMMAND_NAMES[kind])
      .setDescription(DESCRIPTIONS[kind]),

    async execute(interaction, ctx) {
      const amount = definition.reward(ctx.rng);

      if (kind === "daily") {
        const daily = await ctx.users.claimDaily({
          userId: interaction.user.id,
          cooldownMs: definition.cooldownMs,
          baseAmount: amount,
          now: ctx.clock.now(),
        });

        if (!daily.ok) {
          await interaction.reply({
            embeds: [cooldownEmbed(definition.label, daily.nextAt)],
          });
          return;
        }

        const streakText =
          daily.bonus > 0
            ? `${daily.streak} Tage am Stück, Bonus: ${bold(currency(daily.bonus))}`
            : `${daily.streak} ${daily.streak === 1 ? "Tag" : "Tage"}`;

        await interaction.reply({
          embeds: [
            successEmbed(
              "Ausgezahlt",
              successMessage(kind, daily.amount, ctx.rng),
              [
                { name: "Streak", value: streakText, inline: true },
                {
                  name: "Kontostand",
                  value: bold(currency(daily.balance)),
                  inline: true,
                },
              ],
            ),
          ],
        });
        return;
      }

      // The cooldown is checked inside the transaction: v1 read the timestamp,
      // then wrote, so firing the command twice in the same tick paid twice.
      const result = await ctx.users.claimWork({
        userId: interaction.user.id,
        kind,
        cooldownMs: definition.cooldownMs,
        amount,
        now: ctx.clock.now(),
      });

      if (!result.ok) {
        await interaction.reply({
          embeds: [cooldownEmbed(definition.label, result.nextAt)],
        });
        return;
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Ausgezahlt",
            successMessage(kind, result.amount, ctx.rng),
            [{ name: "Kontostand", value: bold(currency(result.balance)) }],
          ),
        ],
      });
    },
  };
}

export const workCommand = createWorkCommand("hourly");
export const dailyCommand = createWorkCommand("daily");
export const weeklyCommand = createWorkCommand("weekly");
