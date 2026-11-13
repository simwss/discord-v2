/** Injectable time source so cooldown logic is testable without fake timers. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** Fixed clock for tests. */
export function fixedClock(timestamp: number): Clock {
  return { now: () => timestamp };
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

/** Midnight UTC at the start of the day containing `timestamp`. */
export function startOfUtcDay(timestamp: number): number {
  return timestamp - mod(timestamp, DAY_MS);
}

/**
 * Monday 00:00 UTC at the start of the week containing `timestamp`.
 * The Unix epoch fell on a Thursday, so weeks are shifted by three days.
 */
export function startOfUtcWeek(timestamp: number): number {
  return timestamp - mod(timestamp + 3 * DAY_MS, WEEK_MS);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
