import { describe, expect, it } from "vitest";
import { clampPage, LEADERBOARD_PAGE_SIZE, pageCount } from "./leaderboard.js";

describe("pageCount", () => {
  it("is at least one page", () => {
    expect(pageCount(0)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(pageCount(LEADERBOARD_PAGE_SIZE + 1)).toBe(2);
  });
});

describe("clampPage", () => {
  it("keeps a valid page", () => {
    expect(clampPage(1, 25)).toBe(1);
  });

  it("moves past-the-end requests to the last page", () => {
    expect(clampPage(9, 25)).toBe(2);
  });

  it("rejects negative and fractional pages", () => {
    expect(clampPage(-1, 25)).toBe(0);
    expect(clampPage(1.5, 25)).toBe(0);
  });
});
