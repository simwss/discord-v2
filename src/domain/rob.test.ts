import { describe, expect, it } from "vitest";
import { seededRng, type Rng } from "../core/random.js";
import { MIN_ROBBER_BALANCE, MIN_VICTIM_BALANCE, resolveRob } from "./rob.js";

/** Returns the given values from `int`, in order: steal percent, then roll. */
function sequenceRng(values: number[]): Rng {
  let i = 0;
  return { ...seededRng(1), int: () => values[i++] ?? 0 };
}

const SUCCESS = 0;
const CAUGHT = 99;

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

  it("steals between 10 and 30 percent of the victim's balance", () => {
    expect(resolveRob(sequenceRng([0, SUCCESS]), 1_000_000, 100_000)).toEqual({
      kind: "success",
      amount: 10_000,
    });
    expect(resolveRob(sequenceRng([20, SUCCESS]), 1_000_000, 100_000)).toEqual({
      kind: "success",
      amount: 30_000,
    });
  });

  it("never steals more than the robber owns", () => {
    expect(resolveRob(sequenceRng([20, SUCCESS]), 1_000, 100_000_000)).toEqual({
      kind: "success",
      amount: 1_000,
    });
  });

  it("fines exactly what the robbery would have paid", () => {
    expect(resolveRob(sequenceRng([10, CAUGHT]), 1_000_000, 100_000)).toEqual({
      kind: "caught",
      fine: 20_000,
    });
    expect(resolveRob(sequenceRng([10, CAUGHT]), 1_000, 100_000_000)).toEqual({
      kind: "caught",
      fine: 1_000,
    });
  });

  it("loses money on average, even against a much richer victim", () => {
    const rng = seededRng(5);
    let net = 0;
    for (let i = 0; i < 10_000; i++) {
      const result = resolveRob(rng, 1_000, 100_000_000);
      if (result.kind === "success") net += result.amount;
      if (result.kind === "caught") net -= result.fine;
    }
    expect(net).toBeLessThan(0);
  });
});
