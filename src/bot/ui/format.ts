/** Presentation helpers shared by every embed. */

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
 * Joins user mentions for an embed field. Embed field values may not be
 * empty, so an empty list renders a placeholder.
 */
export function mentionList(userIds: readonly string[]): string {
  if (userIds.length === 0) return "Niemand";
  return userIds.map(mention).join(", ");
}
