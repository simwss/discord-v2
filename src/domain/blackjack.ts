import type { Rng } from "../core/random.js";
import { GameRuleError } from "../core/errors.js";

export const SUITS = ["♠️", "♥️", "♣️", "♦️"] as const;
export type Suit = (typeof SUITS)[number];

/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
export type Rank = number;

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

export const BLACKJACK = 21;
export const DEALER_STANDS_AT = 17;

export type BlackjackOutcome = "natural" | "won" | "push" | "lost";
export type BlackjackStatus = "playing" | "finished";

export interface BlackjackState {
  readonly stake: number;
  readonly deck: readonly Card[];
  readonly dealer: readonly Card[];
  readonly player: readonly Card[];
  readonly status: BlackjackStatus;
  readonly outcome: BlackjackOutcome | null;
}

/**
 * A real 52-card deck. v1 built a rankless deck and picked a random suit at
 * *render* time, so a card's suit changed every time the embed was redrawn.
 */
export function createDeck(rng: Rng): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ rank, suit });
    }
  }
  return rng.shuffle(cards);
}

/** Face cards count 10; aces count 11 and soften to 1 as needed. */
export function handValue(cards: readonly Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 1) {
      aces += 1;
      value += 11;
    } else {
      value += Math.min(card.rank, 10);
    }
  }

  while (value > BLACKJACK && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

export function isNatural(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards) === BLACKJACK;
}

function draw(deck: readonly Card[]): { card: Card; rest: Card[] } {
  const [card, ...rest] = deck;
  if (!card) {
    // 52 cards against a hand that busts past 21 makes this unreachable, but
    // an exhausted deck must never silently deal `undefined`.
    throw new GameRuleError("Das Deck ist leer. Starte ein neues Spiel.");
  }
  return { card, rest };
}

export function startGame(stake: number, rng: Rng): BlackjackState {
  let deck = createDeck(rng);

  const first = draw(deck);
  deck = first.rest;
  const second = draw(deck);
  deck = second.rest;
  const third = draw(deck);
  deck = third.rest;

  return {
    stake,
    deck,
    dealer: [first.card],
    player: [second.card, third.card],
    status: "playing",
    outcome: null,
  };
}

function assertPlaying(state: BlackjackState): void {
  if (state.status !== "playing") {
    throw new GameRuleError("Du hast kein laufendes Spiel.");
  }
}

export function hit(state: BlackjackState): BlackjackState {
  assertPlaying(state);

  const { card, rest } = draw(state.deck);
  const player = [...state.player, card];

  if (handValue(player) > BLACKJACK) {
    return {
      ...state,
      deck: rest,
      player,
      status: "finished",
      outcome: "lost",
    };
  }

  return { ...state, deck: rest, player };
}

/** Player stands: the dealer draws to 17 and the hand is settled. */
export function stand(state: BlackjackState): BlackjackState {
  assertPlaying(state);

  let deck = state.deck;
  const dealer = [...state.dealer];

  while (handValue(dealer) < DEALER_STANDS_AT) {
    const { card, rest } = draw(deck);
    dealer.push(card);
    deck = rest;
  }

  return {
    ...state,
    deck,
    dealer,
    status: "finished",
    outcome: settle(state.player, dealer),
  };
}

export function settle(
  player: readonly Card[],
  dealer: readonly Card[],
): BlackjackOutcome {
  const playerValue = handValue(player);
  const dealerValue = handValue(dealer);

  if (playerValue > BLACKJACK) return "lost";
  if (isNatural(player) && dealerValue !== BLACKJACK) return "natural";
  if (dealerValue > BLACKJACK) return "won";
  if (playerValue > dealerValue) return "won";
  if (playerValue === dealerValue) return "push";
  return "lost";
}

/**
 * Amount credited back to the player. The stake is debited when the game
 * starts, so `0` is a total loss and `stake` is a push.
 */
export function payout(outcome: BlackjackOutcome, stake: number): number {
  switch (outcome) {
    case "natural":
      return Math.round(stake * 2.5);
    case "won":
      return stake * 2;
    case "push":
      return stake;
    case "lost":
      return 0;
  }
}
