import type { ComponentHandler } from "./types.js";
import { UserFacingError } from "../../core/errors.js";
import { isLeaderboardMetric } from "../../domain/leaderboard.js";
import { LEADERBOARD_NAMESPACE } from "../ui/components.js";
import { renderLeaderboard } from "../leaderboard-view.js";

/**
 * Page buttons. Anyone in the channel may flip pages: the leaderboard is
 * public, so there is no owner to protect.
 */
export const leaderboardComponent: ComponentHandler = {
  namespace: LEADERBOARD_NAMESPACE,

  async handle(interaction, ctx, id) {
    const [metric, rawPage] = id.args;
    const page = Number(rawPage);

    if (
      id.action !== "page" ||
      metric === undefined ||
      !isLeaderboardMetric(metric) ||
      !Number.isInteger(page)
    ) {
      throw new UserFacingError("Diese Seite gibt es nicht.");
    }

    // Resolving usernames can exceed the 3 second window for an update.
    await interaction.deferUpdate();
    await interaction.editReply(
      await renderLeaderboard(interaction.client, ctx, metric, page),
    );
  },
};
