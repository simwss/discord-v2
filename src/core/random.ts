import { randomInt } from "node:crypto";

/**
 * Randomness is injected rather than imported so game logic stays pure and
 * tests can pin outcomes with a deterministic sequence.
 */
export interface Rng {
  /** Uniform integer in `[0, maxExclusive)`. */
  int(maxExclusive: number): number;
  /** Uniform element of a non-empty array. */
  pick<T>(items: readonly [T, ...T[]]): T;
  /** Returns a new array shuffled uniformly (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability 0.5. */
  bool(): boolean;
}

function makeRng(int: (maxExclusive: number) => number): Rng {
  return {
    int,
    pick<T>(items: readonly [T, ...T[]]): T {
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
      }
      return copy;
    },
    bool(): boolean {
      return int(2) === 1;
    },
  };
}

/**
 * Cryptographically secure RNG. `Math.random` is seeded from a value an
 * attacker can influence and is not suitable for anything users can win
 * currency from.
 */
export const cryptoRng: Rng = makeRng((maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
    throw new RangeError(`maxExclusive must be a positive integer`);
  }
  return randomInt(maxExclusive);
});

/**
 * Deterministic RNG for tests. Uses a mulberry32 PRNG — reproducible across
 * runs and platforms, and explicitly not for production use.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return makeRng((maxExclusive) => Math.floor(nextFloat() * maxExclusive));
}
