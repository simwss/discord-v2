import { describe, expect, it } from "vitest";
import { outcomeOf, tally, voteSchema } from "./vote.js";

describe("tally", () => {
  it("splits yes from no", () => {
    const result = tally({ a: true, b: false, c: true });
    expect(result.accepted).toEqual(["a", "c"]);
    expect(result.declined).toEqual(["b"]);
  });

  it("handles an empty ballot box", () => {
    expect(tally({})).toEqual({ accepted: [], declined: [] });
  });
});

describe("outcomeOf", () => {
  it("passes on a strict majority", () => {
    expect(outcomeOf({ accepted: ["a", "b"], declined: ["c"] })).toBe("passed");
  });

  it("rejects a tie", () => {
    expect(outcomeOf({ accepted: ["a"], declined: ["b"] })).toBe("rejected");
  });

  it("rejects an empty vote", () => {
    expect(outcomeOf({ accepted: [], declined: [] })).toBe("rejected");
  });
});

describe("voteSchema", () => {
  it("defaults a record missing optional fields", () => {
    const parsed = voteSchema.parse({ id: "1", description: "Test" });
    expect(parsed.users).toEqual({});
    expect(parsed.closed).toBe(false);
  });

  it("rejects a record without an id", () => {
    expect(voteSchema.safeParse({ description: "Test" }).success).toBe(false);
  });
});
