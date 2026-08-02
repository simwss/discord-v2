import { setTimeout as delay } from "node:timers/promises";

/** Promise-based sleep that does not keep the event loop alive on shutdown. */
export function sleep(ms: number): Promise<void> {
  return delay(ms, undefined, { ref: false });
}
