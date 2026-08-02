import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { BotContext } from "../context.js";

/**
 * Structural type satisfied by every discord.js slash-command builder variant
 * (plain, options-only, subcommands-only) without naming them individually.
 */
export interface CommandData {
  readonly name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

/**
 * A command owns both its Discord-facing definition and its handler, so the
 * registration script cannot drift from what the bot actually implements.
 * v1 kept the two in separate files and shipped a `/drink` command with no
 * handler at all.
 */
export interface BotCommand {
  readonly data: CommandData;
  execute(
    interaction: ChatInputCommandInteraction,
    ctx: BotContext,
  ): Promise<void>;
}
