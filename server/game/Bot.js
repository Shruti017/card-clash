/* =========================================================
   server/game/Bot.js
   Server-side bot decisions for online multiplayer.
   Bots "think" and choose real moves (not random clicks).
   ========================================================= */
const { canPlayCard, CARD_COLORS } = require("./Deck");

function mostCommonColor(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  let best = "red", bestN = -1;
  for (const k in counts) if (counts[k] > bestN) { bestN = counts[k]; best = k; }
  return best;
}

function getPlayable(hand, current) {
  return hand.filter((c) => canPlayCard(c, current));
}

function chooseBotCard(bot, hand, current, oppCounts) {
  const playable = getPlayable(hand, current);
  if (playable.length === 0) return null;

  const style = bot.personalityStyle || "strategic";
  const diff = bot.difficulty || "normal";

  if (style === "unpredictable") {
    return playable[Math.floor(Math.random() * playable.length)];
  }
  if (diff === "easy") return playable[0];

  const minOpp = oppCounts.length ? Math.min.apply(null, oppCounts) : 99;
  const underThreat = minOpp <= 2;

  function score(card) {
    let s = 0;
    if (card.type === "number") s += card.value + 2;
    else if (["freeze", "switch", "double"].includes(card.type)) { s += 12; if (underThreat) s += 25; }
    else if (card.type === "colorShift") { s += 6; if (underThreat) s += 10; }
    else if (card.type === "chaos") { s += 8; if (underThreat) s += 30; }
    return s;
  }

  let ranked = playable.map((c) => ({ card: c, s: score(c) }));
  if (style === "aggressive") {
    ranked.sort((a, b) => b.s - a.s);
    if (!underThreat && Math.random() < 0.4 && playable.some((c) => c.type === "number"))
      return playable.find((c) => c.type === "number");
    return ranked[0].card;
  }
  // strategic / hard
  if (diff === "hard") {
    const hasColored = playable.some((c) => c.color);
    ranked.forEach((r) => {
      if ((r.card.type === "colorShift" || r.card.type === "chaos") && hasColored) r.s -= 18;
    });
  }
  ranked.sort((a, b) => b.s - a.s);
  return ranked[0].card;
}

function chooseBotColor(hand, difficulty) {
  if (difficulty === "hard" || difficulty === "normal") return mostCommonColor(hand);
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
}

module.exports = { chooseBotCard, chooseBotColor, getPlayable, mostCommonColor };
