import { describe, expect, it } from "vitest";
import { seededRng, type Rng } from "../core/random.js";
import { MIN_ROBBER_BALANCE, MIN_VICTIM_BALANCE, resolveRob } from "./rob.js";

/** Returns the given values from `int`, in order. */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return { ...seededRng(1), int: () => values[i++] ?? 0 };
}

describe("resolveRob", () => {
  it("rejects a victim with too little money", () => {
    expect(resolveRob(seededRng(1), 10_000, MIN_VICTIM_BALANCE - 1)).toEqual({
      kind: "rejected",
      reason: "victim_poor",
    });
  });

  it("rejects a robber who could not pay the fine", () => {
    expect(resolveRob(seededRng(1), MIN_ROBBER_BALANCE - 1, 10_000)).toEqual({
      kind: "rejected",
      reason: "robber_poor",
    });
  });

  it("steals between 10 and 30 percent on success", () => {
    expect(resolveRob(sequenceRng([0, 0]), 5_000, 100_000)).toEqual({
      kind: "success",
      amount: 10_000,
    });
    expect(resolveRob(sequenceRng([0, 20]), 5_000, 100_000)).toEqual({
      kind: "success",
      amount: 30_000,
    });
  });

  it("never steals more than the victim has", () => {
    const rng = seededRng(3);
    for (let i = 0; i < 200; i++) {
      const result = resolveRob(rng, 5_000, 2_000);
      if (result.kind === "success") {
        expect(result.amount).toBeLessThanOrEqual(2_000);
      }
    }
  });

  it("fines 15 percent when caught, at least the minimum", () => {
    expect(resolveRob(sequenceRng([99]), 100_000, 50_000)).toEqual({
      kind: "caught",
      fine: 15_000,
    });
    expect(resolveRob(sequenceRng([99]), 2_000, 50_000)).toEqual({
      kind: "caught",
      fine: 1_000,
    });
  });
});
