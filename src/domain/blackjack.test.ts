import { describe, expect, it } from "vitest";
import { seededRng } from "../core/random.js";
import { GameRuleError } from "../core/errors.js";
import {
  createDeck,
  handValue,
  hit,
  isNatural,
  payout,
  settle,
  stand,
  startGame,
  type Card,
  type Suit,
} from "./blackjack.js";

const card = (rank: number, suit: Suit = "♠️"): Card => ({ rank, suit });

describe("createDeck", () => {
  it("produces a full 52-card deck", () => {
    const deck = createDeck(seededRng(1));
    expect(deck).toHaveLength(52);

    const unique = new Set(deck.map((c) => `${c.rank}${c.suit}`));
    expect(unique.size).toBe(52);
  });

  it("gives every rank exactly four cards, one per suit", () => {
    const deck = createDeck(seededRng(7));
    for (let rank = 1; rank <= 13; rank++) {
      expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
    }
  });

  it("shuffles", () => {
    const a = createDeck(seededRng(1));
    const b = createDeck(seededRng(2));
    expect(a).not.toEqual(b);
  });
});

describe("handValue", () => {
  it("counts face cards as ten", () => {
    expect(handValue([card(11), card(12)])).toBe(20);
    expect(handValue([card(13), card(10)])).toBe(20);
  });

  it("counts an ace as eleven when it fits", () => {
    expect(handValue([card(1), card(9)])).toBe(20);
  });

  it("softens aces to avoid busting", () => {
    expect(handValue([card(1), card(9), card(5)])).toBe(15);
  });

  it("softens multiple aces one at a time", () => {
    expect(handValue([card(1), card(1)])).toBe(12);
    expect(handValue([card(1), card(1), card(1)])).toBe(13);
    expect(handValue([card(1), card(1), card(9)])).toBe(21);
  });

  it("is zero for an empty hand", () => {
    expect(handValue([])).toBe(0);
  });
});

describe("isNatural", () => {
  it("requires exactly two cards totalling 21", () => {
    expect(isNatural([card(1), card(13)])).toBe(true);
    expect(isNatural([card(7), card(7), card(7)])).toBe(false);
  });
});

describe("settle", () => {
  const dealer17 = [card(10), card(7)];

  it("loses when the player busts", () => {
    expect(settle([card(10), card(10), card(5)], dealer17)).toBe("lost");
  });

  it("pays a natural", () => {
    expect(settle([card(1), card(13)], dealer17)).toBe("natural");
  });

  it("pushes a natural against a dealer 21", () => {
    expect(settle([card(1), card(13)], [card(1), card(10)])).toBe("push");
  });

  it("wins when the dealer busts", () => {
    expect(settle([card(10), card(5)], [card(10), card(6), card(10)])).toBe(
      "won",
    );
  });

  it("compares totals otherwise", () => {
    expect(settle([card(10), card(9)], dealer17)).toBe("won");
    expect(settle([card(10), card(6)], dealer17)).toBe("lost");
    expect(settle([card(10), card(7)], dealer17)).toBe("push");
  });
});

describe("payout", () => {
  it("returns stake plus 1.5x for a natural", () => {
    expect(payout("natural", 100)).toBe(250);
  });

  it("returns double for a win and the stake for a push", () => {
    expect(payout("won", 100)).toBe(200);
    expect(payout("push", 100)).toBe(100);
  });

  it("returns nothing for a loss", () => {
    expect(payout("lost", 100)).toBe(0);
  });

  it("rounds a natural on an odd stake", () => {
    expect(payout("natural", 5)).toBe(13);
  });
});

describe("game flow", () => {
  it("deals one card to the dealer and two to the player", () => {
    const game = startGame(50, seededRng(3));
    expect(game.dealer).toHaveLength(1);
    expect(game.player).toHaveLength(2);
    expect(game.deck).toHaveLength(49);
    expect(game.status).toBe("playing");
  });

  it("draws from the deck on a hit", () => {
    const game = startGame(50, seededRng(3));
    const next = hit(game);
    expect(next.player).toHaveLength(3);
    expect(next.deck).toHaveLength(48);
  });

  it("finishes the hand as lost when a hit busts", () => {
    const state = {
      stake: 10,
      deck: [card(10), card(2)],
      dealer: [card(9)],
      player: [card(10), card(10)],
      status: "playing" as const,
      outcome: null,
    };
    const next = hit(state);
    expect(next.status).toBe("finished");
    expect(next.outcome).toBe("lost");
  });

  it("makes the dealer draw to 17 on a stand", () => {
    const state = {
      stake: 10,
      deck: [card(5), card(5), card(5)],
      dealer: [card(2)],
      player: [card(10), card(9)],
      status: "playing" as const,
      outcome: null,
    };
    const next = stand(state);
    expect(handValue(next.dealer)).toBeGreaterThanOrEqual(17);
    expect(next.status).toBe("finished");
  });

  it("refuses to act on a finished hand", () => {
    const finished = stand(startGame(10, seededRng(4)));
    expect(() => hit(finished)).toThrow(GameRuleError);
    expect(() => stand(finished)).toThrow(GameRuleError);
  });

  it("throws rather than dealing undefined from an empty deck", () => {
    const state = {
      stake: 10,
      deck: [],
      dealer: [card(9)],
      player: [card(2), card(3)],
      status: "playing" as const,
      outcome: null,
    };
    expect(() => hit(state)).toThrow(GameRuleError);
  });
});
