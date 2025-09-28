function createDeck() {
  let deck = [];

  // add all cards
  for (let i = 1; i <= 13; i++) {
    deck = deck.concat([i, i, i, i]);
  }

  // shuffle deck
  deck.sort(() => Math.random() - 0.5);
  return deck;
}

function getHandValue(cards) {
  let value = 0;
  let aces = 0;
  for (let card of cards) {
    if (card > 10) {
      value += 10;
    } else if (card === 1) {
      aces += 1;
      value += 11;
    } else {
      value += card;
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
}

/**
 * helper function for createBlackjackEmbed
 */
function getCardEmoji(card) {
  const suits = ["♠️", "♥️", "♣️", "♦️"];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  let value = card;
  switch (card) {
    case 1:
      value = "A";
      break;
    case 11:
      value = "J";
      break;
    case 12:
      value = "Q";
      break;
    case 13:
      value = "K";
      break;
  }
  return {
    value: card > 10 ? 10 : card,
    emoji: `${value}${suit}`,
  };
}

function createBlackjackEmbed(dealerCards, playerCards, revealDealer = false) {
  const dealerValue = revealDealer
    ? getHandValue(dealerCards)
    : getHandValue([dealerCards[0]]);
  const dealerHand = revealDealer
    ? dealerCards.map((card) => getCardEmoji(card).emoji).join(" ")
    : `${getCardEmoji(dealerCards[0]).emoji} 🃏`;

  return {
    title: "BlackJack",
    fields: [
      {
        name: "Dealer",
        value: `(${dealerValue}) ${dealerHand}`,
        inline: true,
      },
      {
        name: "Player",
        value: `(${getHandValue(playerCards)}) ${playerCards
          .map((card) => getCardEmoji(card).emoji)
          .join(" ")}`,
        inline: true,
      },
    ],
  };
}

export { createDeck, getHandValue, createBlackjackEmbed };
