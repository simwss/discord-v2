import { describe, expect, it } from "vitest";
import {
  minerField,
  newUserRecord,
  STARTING_BALANCE,
  toProfile,
  workField,
} from "./user.js";

describe("toProfile", () => {
  it("fills in defaults for a missing record", () => {
    const profile = toProfile("123", null);
    expect(profile).toEqual({
      id: "123",
      balance: STARTING_BALANCE,
      authorised: false,
      miners: { basic: 0, elite: 0, deluxe: 0 },
      lastMineAt: 0,
      workClaimedAt: { hourly: 0, daily: 0, weekly: 0 },
    });
  });

  it("reads a full v1 record", () => {
    const profile = toProfile("123", {
      balance: 4_200,
      authorised: true,
      basicMiners: 2,
      eliteMiners: 1,
      deluxeMiners: 0,
      lastMine: 1_000,
      hourlyWorkTimestamp: 2_000,
      dailyWorkTimestamp: 3_000,
      weeklyWorkTimestamp: 4_000,
    });

    expect(profile.balance).toBe(4_200);
    expect(profile.authorised).toBe(true);
    expect(profile.miners).toEqual({ basic: 2, elite: 1, deluxe: 0 });
    expect(profile.workClaimedAt.daily).toBe(3_000);
  });

  it("defaults fields a v1 record predates", () => {
    const profile = toProfile("123", { balance: 500 });
    expect(profile.balance).toBe(500);
    expect(profile.miners.basic).toBe(0);
    expect(profile.workClaimedAt.weekly).toBe(0);
  });

  it("replaces corrupt values instead of propagating NaN", () => {
    const profile = toProfile("123", {
      balance: "not a number",
      basicMiners: -4,
      authorised: "yes",
    });
    expect(profile.balance).toBe(STARTING_BALANCE);
    expect(profile.miners.basic).toBe(0);
    expect(profile.authorised).toBe(false);
  });

  it("never throws on arbitrary input", () => {
    for (const input of [undefined, 0, "", [], true]) {
      expect(() => toProfile("123", input)).not.toThrow();
    }
  });
});

describe("field name mapping", () => {
  it("matches the v1 database layout so no migration is needed", () => {
    expect(minerField("basic")).toBe("basicMiners");
    expect(minerField("elite")).toBe("eliteMiners");
    expect(minerField("deluxe")).toBe("deluxeMiners");
    expect(workField("hourly")).toBe("hourlyWorkTimestamp");
    expect(workField("daily")).toBe("dailyWorkTimestamp");
    expect(workField("weekly")).toBe("weeklyWorkTimestamp");
  });
});

describe("newUserRecord", () => {
  it("round-trips through toProfile", () => {
    const record = newUserRecord("999");
    expect(toProfile("999", record).balance).toBe(STARTING_BALANCE);
  });
});
