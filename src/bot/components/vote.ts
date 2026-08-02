import type { ComponentHandler } from "./types.js";
import { UserFacingError } from "../../core/errors.js";
import { outcomeOf, tally, type Vote } from "../../domain/vote.js";
import { voteEmbed } from "../ui/embeds.js";
import { VOTE_NAMESPACE, voteButtons } from "../ui/components.js";
import { updateMessage } from "../reply.js";
import type { BotContext } from "../context.js";

const OUTCOME_TEXT = {
  passed: "Der Vorschlag wurde **durchgesetzt**.",
  rejected: "Der Vorschlag wurde **abgelehnt**.",
} as const;

async function authorName(
  ctx: BotContext,
  interaction: {
    client: {
      users: { fetch: (id: string) => Promise<{ displayName: string }> };
    };
  },
  authorId: string,
): Promise<string> {
  if (authorId === "") return "Unbekannt";
  try {
    return (await interaction.client.users.fetch(authorId)).displayName;
  } catch (error) {
    ctx.logger.debug({ err: error, authorId }, "vote author not resolvable");
    return "Unbekannt";
  }
}

export const voteComponent: ComponentHandler = {
  namespace: VOTE_NAMESPACE,

  async handle(interaction, ctx, id) {
    const [voteId] = id.args;
    if (!voteId) {
      throw new UserFacingError("Abstimmung nicht gefunden.");
    }

    if (id.action === "end") {
      await endVote(interaction, ctx, voteId);
      return;
    }

    const choice = id.action === "yes" ? "yes" : "no";
    const result = await ctx.votes.cast(voteId, interaction.user.id, choice);

    if (!result.ok) {
      throw new UserFacingError(
        result.reason === "closed"
          ? "Diese Abstimmung ist bereits beendet."
          : "Abstimmung nicht gefunden.",
      );
    }

    await renderVote(interaction, ctx, result.vote, false);
  },
};

async function endVote(
  interaction: Parameters<ComponentHandler["handle"]>[0],
  ctx: BotContext,
  voteId: string,
): Promise<void> {
  if (!(await ctx.users.isAuthorised(interaction.user.id))) {
    throw new UserFacingError(
      "Du hast keine Berechtigung, die Abstimmung zu beenden.",
      "Nicht autorisiert",
    );
  }

  const closed = await ctx.votes.close(voteId);
  if (!closed) {
    throw new UserFacingError(
      "Abstimmung nicht gefunden oder bereits beendet.",
    );
  }

  ctx.logger.info({ voteId, actorId: interaction.user.id }, "vote closed");
  await renderVote(interaction, ctx, closed, true);
}

async function renderVote(
  interaction: Parameters<ComponentHandler["handle"]>[0],
  ctx: BotContext,
  vote: Vote,
  closed: boolean,
): Promise<void> {
  const counts = tally(vote.users);
  const embed = voteEmbed({
    description: vote.description,
    authorName: await authorName(ctx, interaction, vote.authorId),
    authorId: vote.authorId,
    tally: counts,
    closed,
  });

  await updateMessage(interaction, {
    ...(closed ? { content: OUTCOME_TEXT[outcomeOf(counts)] } : {}),
    embeds: [embed],
    components: closed ? [] : [voteButtons(vote.id)],
  });
}
