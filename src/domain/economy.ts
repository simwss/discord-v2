import { DAY_MS, HOUR_MS, WEEK_MS } from "../core/clock.js";
import type { Rng } from "../core/random.js";
import { GameRuleError } from "../core/errors.js";
import type { WorkKind } from "./user.js";

export interface WorkDefinition {
  readonly kind: WorkKind;
  /** German label used in cooldown messages. */
  readonly label: string;
  readonly cooldownMs: number;
  readonly reward: (rng: Rng) => number;
}

export const WORK: Readonly<Record<WorkKind, WorkDefinition>> = {
  hourly: {
    kind: "hourly",
    label: "stündliche",
    cooldownMs: HOUR_MS,
    reward: (rng) => 900 + rng.int(100),
  },
  daily: {
    kind: "daily",
    label: "tägliche",
    cooldownMs: DAY_MS,
    reward: () => 5_000,
  },
  weekly: {
    kind: "weekly",
    label: "wöchentliche",
    cooldownMs: WEEK_MS,
    reward: () => 100_000,
  },
};

export function isCooldownActive(
  lastClaimedAt: number,
  cooldownMs: number,
  now: number,
): boolean {
  return lastClaimedAt > 0 && now - lastClaimedAt < cooldownMs;
}

export function nextAvailableAt(
  lastClaimedAt: number,
  cooldownMs: number,
): number {
  return lastClaimedAt + cooldownMs;
}

export const MAX_STAKE = 1_000_000_000_000;

/**
 * Validates a wager against the user's balance.
 *
 * @throws {GameRuleError} with a message safe to show the user.
 */
export function assertValidStake(stake: number, balance: number): void {
  if (!Number.isInteger(stake) || stake <= 0) {
    throw new GameRuleError(
      "Der Einsatz muss eine ganze Zahl größer als 0 sein.",
    );
  }
  if (stake > MAX_STAKE) {
    throw new GameRuleError(
      `Der Einsatz darf höchstens ${MAX_STAKE.toLocaleString("de-DE")}$ betragen.`,
    );
  }
  if (stake > balance) {
    throw new GameRuleError("Du hast nicht genug Geld für diesen Einsatz.");
  }
}

/**
 * Validates a peer-to-peer transfer amount.
 *
 * @throws {GameRuleError}
 */
export function assertValidTransfer(amount: number, balance: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameRuleError(
      "Du kannst nur einen positiven Betrag verschicken.",
    );
  }
  if (amount > balance) {
    throw new GameRuleError("Du hast nicht genug Geld.");
  }
}
