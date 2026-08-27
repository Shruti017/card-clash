/* =========================================================
   cards.js  -  Card definitions, deck, rules, and rendering
   Pure browser code (no server required) for BOT MODE.
   Also reused by the multiplayer client for rendering.
   ========================================================= */

// The four colors used in Card Clash.
const CARD_COLORS = ["red", "blue", "green", "yellow"];

// Special card type identifiers (original names).
//  freeze    = "Skip"  (next player loses their turn)
//  switch    = "Reverse" (changes direction)
//  double    = "Draw 2" (next player draws 2 and is skipped)
//  colorShift= "Wild"  (player picks a new color)
//  chaos     = "Wild Draw 4" (player picks color, next draws 4 + skipped)
const SPECIAL_TYPES = ["freeze", "switch", "double", "colorShift", "chaos"];

// Short symbol shown in card corners.
function symbolText(card) {
  switch (card.type) {
    case "number": return String(card.value);
    case "freeze": return "❄";      // snowflake
    case "switch": return "⇄";      // double arrow
    case "double": return "+2";
    case "colorShift": return "★";  // star
    case "chaos": return "✫";       // star burst
    default: return "?";
  }
}

// Point value used for scoring at the end of a round.
function cardPoints(card) {
  if (card.type === "number") return card.value;
  if (card.type === "colorShift" || card.type === "chaos") return 50;
  return 20; // freeze / switch / double
}

let _cardIdCounter = 0;

// Build a full 108-card deck (UNO-like distribution).
function createDeck() {
  const deck = [];
  _cardIdCounter = 0;

  // Helper to push a card with a unique id.
  function add(color, type, value) {
    deck.push({
      id: "c" + (_cardIdCounter++),
      color: color,
      type: type,
      value: value === undefined ? null : value,
      points: cardPoints({ type, value }),
      chosenColor: null // used only for wilds after a color is picked
    });
  }

  CARD_COLORS.forEach((color) => {
    // One "0" per color.
    add(color, "number", 0);
    // Two of each 1-9 per color.
    for (let v = 1; v <= 9; v++) {
      add(color, "number", v);
      add(color, "number", v);
    }
    // Two of each colored special per color.
    add(color, "freeze");
    add(color, "freeze");
    add(color, "switch");
    add(color, "switch");
    add(color, "double");
    add(color, "double");
  });

  // Four wilds and four wild-draw-4 (no color until chosen).
  for (let i = 0; i < 4; i++) {
    add(null, "colorShift");
    add(null, "chaos");
  }

  return deck;
}

// Fisher-Yates shuffle (returns the same array, shuffled).
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// The "effective" color of the current card.
// Wilds use their chosenColor once a color has been picked.
function currentColor(card) {
  if (!card) return null;
  return card.chosenColor || card.color;
}

/* ---------------------------------------------------------
   canPlayCard
   Returns true if `card` may be played on top of `current`.
   Rules:
     - Wild cards (colorShift / chaos) are always playable.
     - Same color as the current effective color.
     - Same special type (e.g. freeze on freeze).
     - Same number value.
   --------------------------------------------------------- */
function canPlayCard(card, current) {
  if (!card || !current) return false;

  // Wilds are always playable.
  if (card.type === "colorShift" || card.type === "chaos") return true;

  const active = currentColor(current);

  // Color match.
  if (card.color && card.color === active) return true;

  // Same special type match (any color).
  if (card.type === current.type && card.type !== "number") return true;

  // Same number value.
  if (card.type === "number" && current.type === "number") {
    return card.value === current.value;
  }

  return false;
}

// Returns the HTML for a single card face.
// options: { playable: bool, faceDown: bool }
function renderCardHTML(card, options) {
  options = options || {};
  if (options.faceDown) {
    return '<div class="card-back"><div class="back-pattern"></div><div class="back-logo">CARD<br>CLASH</div></div>';
  }

  const isWild = (card.type === "colorShift" || card.type === "chaos");
  const colorClass = card.color ? card.color : "";
  const wildClass = isWild ? " wild" : "";
  const typeClass = card.type; // number / freeze / switch / double / colorShift / chaos

  const sym = symbolText(card);
  const centerText = card.type === "number" ? card.value : ""; // specials filled by CSS ::before

  const cls = "card " + colorClass + " " + typeClass + wildClass +
    (options.playable ? " playable" : (options.faceDown ? "" : " unplayable"));

  return `
    <div class="${cls}" data-id="${card.id}">
      <div class="card-inner">
        <div class="card-border"></div>
        <div class="corner tl">
          <span class="corner-value">${sym}</span>
        </div>
        <div class="card-center">
          <span class="big-symbol">${centerText}</span>
        </div>
        <div class="corner br">
          <span class="corner-value">${sym}</span>
        </div>
      </div>
    </div>`;
}

// HTML for a face-down card back (used in piles / opponents).
function renderCardBackHTML() {
  return '<div class="card-back"><div class="back-pattern"></div><div class="back-logo">CARD<br>CLASH</div></div>';
}

// Make these available to other scripts (no modules needed).
window.CardClash = {
  CARD_COLORS, SPECIAL_TYPES,
  symbolText, cardPoints,
  createDeck, shuffle, currentColor,
  canPlayCard, renderCardHTML, renderCardBackHTML
};
