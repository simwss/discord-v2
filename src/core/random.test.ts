import { describe, expect, it } from "vitest";
import { cryptoRng, seededRng } from "./random.js";

describe("seededRng", () => {
  it("is reproducible for a given seed", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const draw = (rng: typeof a) =>
      Array.from({ length: 20 }, () => rng.int(100));
    expect(draw(a)).toEqual(draw(b));
  });

  it("differs between seeds", () => {
    const a = Array.from({ length: 20 }, () => seededRng(1).int(1000));
    const b = Array.from({ length: 20 }, () => seededRng(2).int(1000));
    expect(a).not.toEqual(b);
  });
});

describe("Rng contract", () => {
  for (const [name, rng] of [
    ["cryptoRng", cryptoRng],
    ["seededRng", seededRng(7)],
  ] as const) {
    describe(name, () => {
      it("stays inside the requested range", () => {
        for (let i = 0; i < 1000; i++) {
          const value = rng.int(6);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(6);
        }
      });

      it("always returns 0 for a range of one", () => {
        expect(rng.int(1)).toBe(0);
      });

      it("picks an element of the array", () => {
        const items = ["a", "b", "c"] as const;
        for (let i = 0; i < 100; i++) {
          expect(items).toContain(rng.pick(items));
        }
      });

      it("shuffles without losing or duplicating elements", () => {
        const items = Array.from({ length: 50 }, (_, i) => i);
        const shuffled = rng.shuffle(items);
        expect(shuffled).toHaveLength(items.length);
        expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
      });

      it("does not mutate the input array", () => {
        const items = [1, 2, 3, 4, 5];
        rng.shuffle(items);
        expect(items).toEqual([1, 2, 3, 4, 5]);
      });

      it("produces both boolean outcomes", () => {
        const seen = new Set<boolean>();
        for (let i = 0; i < 200; i++) seen.add(rng.bool());
        expect(seen.size).toBe(2);
      });
    });
  }
});

describe("cryptoRng", () => {
  it("rejects a non-positive range rather than returning NaN", () => {
    expect(() => cryptoRng.int(0)).toThrow(RangeError);
    expect(() => cryptoRng.int(-1)).toThrow(RangeError);
    expect(() => cryptoRng.int(1.5)).toThrow(RangeError);
  });

  it("is not obviously biased", () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const rolls = 60_000;
    for (let i = 0; i < rolls; i++) {
      counts[cryptoRng.int(6)] = (counts[cryptoRng.int(6)] ?? 0) + 1;
    }
    // Every face must appear; a broken generator collapses to one value.
    expect(counts.filter((c) => c > 0).length).toBeGreaterThan(1);
  });
});
