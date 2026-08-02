import type { ComponentHandler } from "./types.js";
import { GameRuleError, UserFacingError } from "../../core/errors.js";
import { hit, payout, stand } from "../../domain/blackjack.js";
import { blackjackEmbed } from "../ui/embeds.js";
import { BLACKJACK_NAMESPACE, blackjackButtons } from "../ui/components.js";
import { updateMessage } from "../reply.js";

export const blackjackComponent: ComponentHandler = {
  namespace: BLACKJACK_NAMESPACE,

  async handle(interaction, ctx, id) {
    const [ownerId] = id.args;

    // Buttons are visible to everyone in the channel, so ownership has to be
    // checked on every press rather than trusted from the message.
    if (ownerId !== interaction.user.id) {
      throw new UserFacingError("Das ist nicht dein Spiel.");
    }

    const userId = interaction.user.id;
    const game = await ctx.blackjack.find(userId);

    if (game?.status !== "playing") {
      throw new GameRuleError("Du hast keine laufende Hand.");
    }

    const next = id.action === "hit" ? hit(game) : stand(game);

    if (next.status === "playing") {
      await ctx.blackjack.save(userId, next);
      await updateMessage(interaction, {
        embeds: [blackjackEmbed(next)],
        components: [blackjackButtons(userId)],
      });
      return;
    }

    // Clear the hand before crediting: if the credit fails the game is not
    // left playable, which would let the same hand be settled twice.
    await ctx.blackjack.clear(userId);
    const balance = await ctx.users.credit(
      userId,
      payout(next.outcome ?? "lost", next.stake),
    );

    await updateMessage(interaction, {
      embeds: [blackjackEmbed(next, balance)],
      components: [],
    });
  },
};
