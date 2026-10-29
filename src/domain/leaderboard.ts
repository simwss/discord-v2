export const LEADERBOARD_METRICS = ["balance", "miners", "yield"] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

export const LEADERBOARD_LABELS: Readonly<Record<LeaderboardMetric, string>> = {
  balance: "Guthaben",
  miners: "Miner",
  yield: "Tagesertrag",
};

export const LEADERBOARD_PAGE_SIZE = 10;

export function isLeaderboardMetric(value: string): value is LeaderboardMetric {
  return (LEADERBOARD_METRICS as readonly string[]).includes(value);
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));
}

/** Keeps a requested page inside the range that currently exists. */
export function clampPage(page: number, total: number): number {
  if (!Number.isInteger(page) || page < 0) return 0;
  return Math.min(page, pageCount(total) - 1);
}
