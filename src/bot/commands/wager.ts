import type { SlashCommandIntegerOption } from "discord.js";
import { GameRuleError } from "../../core/errors.js";
import { MAX_STAKE } from "../../domain/economy.js";
import type { BotContext } from "../context.js";

export const STAKE_OPTION_NAME = "betrag";

const INSUFFICIENT_FUNDS = "Du hast nicht genug Geld für diesen Einsatz.";

/** Shared `betrag` option so every game validates stakes identically. */
export function stakeOption(
  option: SlashCommandIntegerOption,
): SlashCommandIntegerOption {
  return option
    .setName(STAKE_OPTION_NAME)
    .setDescription("Wie viel willst du setzen?")
    .setRequired(true)
    .setMinValue(1)
    .setMaxValue(MAX_STAKE);
}

/**
 * Settles a game that resolves instantly, in one transaction. Nothing can
 * observe an intermediate state where the stake is gone but the payout has
 * not landed.
 *
 * @returns the new balance
 * @throws {GameRuleError} when the stake is no longer covered
 */
export async function applyNetResult(
  ctx: BotContext,
  userId: string,
  stake: number,
  payout: number,
): Promise<number> {
  const result = await ctx.users.adjustBalance(userId, payout - stake);
  if (!result.ok) throw new GameRuleError(INSUFFICIENT_FUNDS);
  return result.balance;
}

/**
 * Takes the stake before a game that resolves later (an animation, or a
 * separate button press). Committing the debit up front is what stops a user
 * from having several games in flight backed by the same funds.
 *
 * @returns the balance after the debit
 * @throws {GameRuleError} when the stake is not covered
 */
export async function takeStake(
  ctx: BotContext,
  userId: string,
  stake: number,
): Promise<number> {
  const result = await ctx.users.debitStake(userId, stake);
  if (!result.ok) throw new GameRuleError(INSUFFICIENT_FUNDS);
  return result.balance;
}
