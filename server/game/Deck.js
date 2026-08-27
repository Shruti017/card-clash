/* =========================================================
   server/game/Deck.js
   Server-side deck creation + shuffle + rule helpers.
   Kept consistent with public/js/cards.js.
   ========================================================= */

const CARD_COLORS = ["red", "blue", "green", "yellow"];

function cardPoints(card) {
  if (card.type === "number") return card.value;
  if (card.type === "colorShift" || card.type === "chaos") return 50;
  return 20;
}

function createDeck() {
  const deck = [];
  let id = 0;
  function add(color, type, value) {
    deck.push({
      id: "s" + (id++),
      color: color,
      type: type,
      value: value === undefined ? null : value,
      points: cardPoints({ type, value }),
      chosenColor: null
    });
  }
  CARD_COLORS.forEach((color) => {
    add(color, "number", 0);
    for (let v = 1; v <= 9; v++) { add(color, "number", v); add(color, "number", v); }
    add(color, "freeze"); add(color, "freeze");
    add(color, "switch"); add(color, "switch");
    add(color, "double"); add(color, "double");
  });
  for (let i = 0; i < 4; i++) { add(null, "colorShift"); add(null, "chaos"); }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function currentColor(card) {
  if (!card) return null;
  return card.chosenColor || card.color;
}

// Can `card` be played on `current`?
function canPlayCard(card, current) {
  if (!card || !current) return false;
  if (card.type === "colorShift" || card.type === "chaos") return true;
  const active = currentColor(current);
  if (card.color && card.color === active) return true;
  if (card.type === current.type && card.type !== "number") return true;
  if (card.type === "number" && current.type === "number") return card.value === current.value;
  return false;
}

module.exports = { CARD_COLORS, createDeck, shuffle, currentColor, canPlayCard, cardPoints };
