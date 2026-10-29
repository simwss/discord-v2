import type { RepliableInteraction } from "discord.js";
import type { BotContext } from "./context.js";
import {
  ACHIEVEMENTS_BY_ID,
  earnedAchievementIds,
} from "../domain/achievements.js";
import { bold, mention } from "./ui/format.js";

/**
 * Grants every achievement the user's profile now qualifies for and posts the
 * new ones under the reply. Runs after each interaction, so commands do not
 * need to know which achievements their changes might unlock.
 */
export async function announceNewAchievements(
  interaction: RepliableInteraction,
  ctx: BotContext,
): Promise<void> {
  // Without a reply there is nothing to follow up on.
  if (!interaction.replied && !interaction.deferred) return;

  const userId = interaction.user.id;
  const profile = await ctx.users.find(userId);
  if (!profile) return;

  const unlocked = await ctx.achievements.grant(
    userId,
    earnedAchievementIds(profile),
  );
  if (unlocked.length === 0) return;

  const lines = unlocked.flatMap((id) => {
    const achievement = ACHIEVEMENTS_BY_ID.get(id);
    return achievement
      ? [`🏅 ${bold(achievement.name)}: ${achievement.description}`]
      : [];
  });

  await interaction.followUp({
    content: `${mention(userId)} hat ${lines.length === 1 ? "ein neues Abzeichen" : "neue Abzeichen"}:\n${lines.join("\n")}`,
    allowedMentions: { parse: [] },
  });
}
