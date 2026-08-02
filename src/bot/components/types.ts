import type { MessageComponentInteraction } from "discord.js";
import type { BotContext } from "../context.js";
import type { CustomId } from "../custom-id.js";

export interface ComponentHandler {
  /** First segment of the custom ID this handler claims. */
  readonly namespace: string;
  handle(
    interaction: MessageComponentInteraction,
    ctx: BotContext,
    id: CustomId,
  ): Promise<void>;
}
