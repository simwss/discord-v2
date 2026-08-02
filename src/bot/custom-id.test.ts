import { describe, expect, it } from "vitest";
import {
  decodeCustomId,
  encodeCustomId,
  MAX_CUSTOM_ID_LENGTH,
} from "./custom-id.js";

describe("encodeCustomId / decodeCustomId", () => {
  it("round-trips a namespace, action and args", () => {
    const id = encodeCustomId("bj", "hit", "123456789012345678");
    expect(decodeCustomId(id)).toEqual({
      namespace: "bj",
      action: "hit",
      args: ["123456789012345678"],
    });
  });

  it("round-trips numeric args as strings", () => {
    const id = encodeCustomId("rl", "red", "123", 500);
    expect(decodeCustomId(id)?.args).toEqual(["123", "500"]);
  });

  it("supports an empty arg list", () => {
    expect(decodeCustomId(encodeCustomId("vote", "end"))?.args).toEqual([]);
  });

  it("rejects a segment containing the separator", () => {
    expect(() => encodeCustomId("bj", "hit", "a:b")).toThrow(
      /must not contain/,
    );
  });

  it("rejects an ID Discord would refuse", () => {
    expect(() => encodeCustomId("ns", "action", "x".repeat(120))).toThrow(
      new RegExp(String(MAX_CUSTOM_ID_LENGTH)),
    );
  });

  it("returns null for unparseable input", () => {
    expect(decodeCustomId("")).toBeNull();
    expect(decodeCustomId("onlynamespace")).toBeNull();
  });

  it("keeps underscores intact — v1 split on them and mis-parsed", () => {
    const id = encodeCustomId("vote", "yes", "some_vote_id");
    expect(decodeCustomId(id)?.args).toEqual(["some_vote_id"]);
  });
});
