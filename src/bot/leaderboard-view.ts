import type { Client, InteractionEditReplyOptions } from "discord.js";
import type { BotContext } from "./context.js";
import {
  clampPage,
  LEADERBOARD_PAGE_SIZE,
  pageCount,
  type LeaderboardMetric,
} from "../domain/leaderboard.js";
import { leaderboardEmbed, type LeaderboardEntry } from "./ui/embeds.js";
import { leaderboardButtons } from "./ui/components.js";

/**
 * Builds one leaderboard page. Shared by the slash command and the page
 * buttons so both render identically.
 */
export async function renderLeaderboard(
  client: Client,
  ctx: BotContext,
  metric: LeaderboardMetric,
  requestedPage: number,
): Promise<Pick<InteractionEditReplyOptions, "embeds" | "components">> {
  let page = Math.max(0, requestedPage);
  let result = await ctx.users.leaderboardPage(
    metric,
    LEADERBOARD_PAGE_SIZE,
    page * LEADERBOARD_PAGE_SIZE,
  );

  // The list can shrink between two button presses; fall back to the last
  // page that still exists rather than showing an empty one.
  const clamped = clampPage(page, result.total);
  if (clamped !== page) {
    page = clamped;
    result = await ctx.users.leaderboardPage(
      metric,
      LEADERBOARD_PAGE_SIZE,
      page * LEADERBOARD_PAGE_SIZE,
    );
  }

  const entries: LeaderboardEntry[] = await Promise.all(
    result.rows.map(async (row) => {
      try {
        const user = await client.users.fetch(row.id);
        return { username: user.displayName, value: row.value };
      } catch {
        // A user who left every mutual guild can no longer be resolved;
        // show the raw ID rather than dropping the whole page.
        return { username: `Unbekannt (${row.id})`, value: row.value };
      }
    }),
  );

  const pages = pageCount(result.total);

  return {
    embeds: [
      leaderboardEmbed({
        metric,
        entries,
        offset: page * LEADERBOARD_PAGE_SIZE,
        page,
        pages,
      }),
    ],
    components: pages > 1 ? [leaderboardButtons(metric, page, pages)] : [],
  };
}
