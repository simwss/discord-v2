import { HOUR_MS } from "../core/clock.js";
import type { Rng } from "../core/random.js";

export const ROB_COOLDOWN_MS = 2 * HOUR_MS;
export const ROB_SUCCESS_PERCENT = 40;

/** Robbing someone who has almost nothing is not worth a command. */
export const MIN_VICTIM_BALANCE = 1_000;

/**
 * The robber must be able to pay a fine. Without this, an empty account could
 * rob for free because there would be nothing to lose.
 */
export const MIN_ROBBER_BALANCE = 1_000;

const MIN_STEAL_PERCENT = 10;
const MAX_STEAL_PERCENT = 30;
const FINE_PERCENT = 15;

export type RobDecision =
  | {
      readonly kind: "rejected";
      readonly reason: "victim_poor" | "robber_poor";
    }
  | { readonly kind: "success"; readonly amount: number }
  | { readonly kind: "caught"; readonly fine: number };

/**
 * Only the victim's balance is at stake; miners are never touched. A caught
 * robber pays the fine to the victim.
 */
export function resolveRob(
  rng: Rng,
  robberBalance: number,
  victimBalance: number,
): RobDecision {
  if (victimBalance < MIN_VICTIM_BALANCE) {
    return { kind: "rejected", reason: "victim_poor" };
  }
  if (robberBalance < MIN_ROBBER_BALANCE) {
    return { kind: "rejected", reason: "robber_poor" };
  }

  if (rng.int(100) < ROB_SUCCESS_PERCENT) {
    const percent =
      MIN_STEAL_PERCENT + rng.int(MAX_STEAL_PERCENT - MIN_STEAL_PERCENT + 1);
    return {
      kind: "success",
      amount: Math.max(1, Math.floor((victimBalance * percent) / 100)),
    };
  }

  const fine = Math.min(
    robberBalance,
    Math.max(
      MIN_ROBBER_BALANCE,
      Math.floor((robberBalance * FINE_PERCENT) / 100),
    ),
  );
  return { kind: "caught", fine };
}
