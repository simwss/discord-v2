/** Presentation helpers shared by every embed. */

import { DAY_MS, HOUR_MS, MINUTE_MS } from "../../core/clock.js";

export function currency(amount: number): string {
  return `${amount.toLocaleString("de-DE")}$`;
}

export function bold(text: string): string {
  return `**${text}**`;
}

export function mention(userId: string): string {
  return `<@${userId}>`;
}

/** Discord renders this as a locale-aware absolute timestamp. */
export function absoluteTime(epochMs: number): string {
  return `<t:${Math.floor(epochMs / 1000)}:F>`;
}

/** Discord renders this as a live "in 3 hours" countdown. */
export function relativeTime(epochMs: number): string {
  return `<t:${Math.floor(epochMs / 1000)}:R>`;
}

/**
 * Coarse German duration, e.g. "2 Tage 3 Std". Units below the two most
 * significant ones are dropped; anything under a minute reads "wenige Sekunden".
 */
export function duration(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "Tag" : "Tage"}`);
  if (hours > 0) parts.push(`${hours} Std`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} Min`);

  return parts.length === 0 ? "wenige Sekunden" : parts.join(" ");
}

/**
 * Joins user mentions for an embed field. Embed field values may not be
 * empty, so an empty list renders a placeholder.
 */
export function mentionList(userIds: readonly string[]): string {
  if (userIds.length === 0) return "Niemand";
  return userIds.map(mention).join(", ");
}
