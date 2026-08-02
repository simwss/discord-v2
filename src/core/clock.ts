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
