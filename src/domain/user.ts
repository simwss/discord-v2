export const MINER_TYPES = ["basic", "elite", "deluxe"] as const;
export type MinerType = (typeof MINER_TYPES)[number];

export const WORK_KINDS = ["hourly", "daily", "weekly"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/** The in-memory model the rest of the app works with. Always fully populated. */
export interface UserProfile {
  id: string;
  balance: number;
  authorised: boolean;
  miners: Record<MinerType, number>;
  lastMineAt: number;
  workClaimedAt: Record<WorkKind, number>;
  /** Consecutive days /daily was claimed. */
  dailyStreak: number;
  /** Consecutive blackjack wins; a push leaves it unchanged. */
  blackjackWinStreak: number;
  lastRobAt: number;
  robSuccesses: number;
  robFailures: number;
}

/** Credited once, when a user is first seen. */
export const STARTING_BALANCE = 1000;
