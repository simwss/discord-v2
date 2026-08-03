import { describe, expect, it } from "vitest";
import {
  buildUserUpdate,
  MINER_COLUMN,
  rowToProfile,
  USER_COLUMNS,
  WORK_COLUMN,
  type UserRow,
} from "./user-row.js";

const row: UserRow = {
  id: "123",
  balance: 4_200,
  authorised: true,
  basic_miners: 2,
  elite_miners: 1,
  deluxe_miners: 0,
  last_mine_at: 1_000,
  hourly_work_at: 2_000,
  daily_work_at: 3_000,
  weekly_work_at: 4_000,
};

describe("rowToProfile", () => {
  it("maps every column onto the domain profile", () => {
    expect(rowToProfile(row)).toEqual({
      id: "123",
      balance: 4_200,
      authorised: true,
      miners: { basic: 2, elite: 1, deluxe: 0 },
      lastMineAt: 1_000,
      workClaimedAt: { hourly: 2_000, daily: 3_000, weekly: 4_000 },
    });
  });
});

describe("column maps", () => {
  it("only names columns the schema actually has", () => {
    for (const column of [
      ...Object.values(MINER_COLUMN),
      ...Object.values(WORK_COLUMN),
    ]) {
      expect(USER_COLUMNS).toContain(column);
      expect(row).toHaveProperty(column);
    }
  });
});

describe("buildUserUpdate", () => {
  it("writes only the patched columns, id first", () => {
    const update = buildUserUpdate("123", { balance: 50 });

    expect(update).not.toBeNull();
    expect(update?.text).toContain("balance = $2");
    expect(update?.text).toContain("WHERE id = $1");
    expect(update?.values).toEqual(["123", 50]);
  });

  it("numbers placeholders in column order for a multi-column patch", () => {
    const update = buildUserUpdate("123", {
      last_mine_at: 99,
      balance: 50,
    });

    // USER_COLUMNS order, not the order the keys were written in.
    expect(update?.text).toContain("balance = $2, last_mine_at = $3");
    expect(update?.values).toEqual(["123", 50, 99]);
  });

  it("always refreshes updated_at", () => {
    expect(buildUserUpdate("123", { authorised: true })?.text).toContain(
      "updated_at = now()",
    );
  });

  it("returns null when there is nothing to write", () => {
    expect(buildUserUpdate("123", {})).toBeNull();
  });

  it("ignores keys that are not real columns", () => {
    // A patch built from a stray key must not smuggle it into the SQL.
    const update = buildUserUpdate("123", {
      balance: 1,
      ...{ "id = 'x'; DROP TABLE users; --": 1 },
    });

    expect(update?.text).toBe(
      "UPDATE users SET balance = $2, updated_at = now() WHERE id = $1",
    );
  });
});
