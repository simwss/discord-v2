import { MINER_TYPES, type UserProfile } from "./user.js";

export interface Achievement {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly earned: (profile: UserProfile) => boolean;
}

/**
 * Every achievement is a condition on the profile, so checking them needs no
 * event history. The ids are stored in the database: never rename one.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first_miner",
    name: "Schürfer",
    description: "Ersten Miner gekauft",
    earned: (p) => MINER_TYPES.some((type) => p.miners[type] > 0),
  },
  {
    id: "deluxe",
    name: "Deluxe",
    description: "Einen Deluxe Miner besessen",
    earned: (p) => p.miners.deluxe > 0,
  },
  {
    id: "millionaire",
    name: "Millionär",
    description: "1.000.000$ auf dem Konto",
    earned: (p) => p.balance >= 1_000_000,
  },
  {
    id: "billionaire",
    name: "Milliardär",
    description: "1.000.000.000$ auf dem Konto",
    earned: (p) => p.balance >= 1_000_000_000,
  },
  {
    id: "streak_7",
    name: "Stammgast",
    description: "7 Tage am Stück /daily",
    earned: (p) => p.dailyStreak >= 7,
  },
  {
    id: "blackjack_10",
    name: "Kartenhai",
    description: "10 Blackjack-Siege in Folge",
    earned: (p) => p.blackjackWinStreak >= 10,
  },
  {
    id: "thief",
    name: "Dieb",
    description: "Jemanden ausgeraubt",
    earned: (p) => p.robSuccesses > 0,
  },
  {
    id: "caught",
    name: "Erwischt",
    description: "Beim Rauben erwischt",
    earned: (p) => p.robFailures > 0,
  },
];

export const ACHIEVEMENTS_BY_ID: ReadonlyMap<string, Achievement> = new Map(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

export function earnedAchievementIds(profile: UserProfile): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(profile)).map((a) => a.id);
}
