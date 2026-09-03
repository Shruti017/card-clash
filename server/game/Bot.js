/* =========================================================
   server/game/Bot.js
   Server-side bot decisions for online multiplayer.
   Same enhanced AI as client-side: 5 personalities, smarter
   HARD difficulty with opponent targeting + wild timing.
   ========================================================= */
const { canPlayCard, CARD_COLORS } = require("./Deck");

function mostCommonColor(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  let best = "red", bestN = -1;
  for (const k in counts) if (counts[k] > bestN) { bestN = counts[k]; best = k; }
  return best;
}

function countColors(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  return counts;
}

function getPlayable(hand, current) {
  return hand.filter((c) => canPlayCard(c, current));
}

function chooseBotCard(bot, hand, current, oppCounts) {
  const playable = getPlayable(hand, current);
  if (playable.length === 0) return null;

  const style = bot.personalityStyle || "strategic";
  const diff = bot.difficulty || "normal";
  const handSize = hand.length;
  const minOpp = oppCounts.length ? Math.min.apply(null, oppCounts) : 99;
  const underThreat = minOpp <= 2;
  const iAmClose = handSize <= 3;

  if (diff === "easy") return playable[0];
  if (style === "unpredictable") return playable[Math.floor(Math.random() * playable.length)];

  function score(card) {
    let s = 0;
    if (card.type === "number") {
      s += card.value + 2;
      if (countColors(hand)[card.color] >= 3) s += 5;
    } else if (["freeze", "switch", "double"].includes(card.type)) {
      s += 12;
      if (underThreat) s += 25;
      if (iAmClose) s += 8;
    } else if (card.type === "colorShift") {
      s += 6;
      if (underThreat) s += 10;
      if (diff === "hard" && !playable.some(c => c.color && c !== card)) s += 12;
    } else if (card.type === "chaos") {
      s += 8;
      if (underThreat) s += 30;
      if (iAmClose) s += 15;
    }
    return s;
  }

  if (style === "aggressive") {
    let ranked = playable.map((c) => ({ card: c, s: score(c) }));
    ranked.sort((a, b) => b.s - a.s);
    if (!underThreat && Math.random() < 0.4 && playable.some(c => c.type === "number"))
      return playable.find(c => c.type === "number");
    return ranked[0].card;
  }

  if (style === "sneaky") {
    let ranked = playable.map((c) => ({ card: c, s: score(c) }));
    if (handSize > 5) ranked.forEach((r) => { if (r.card.type === "colorShift" || r.card.type === "chaos") r.s -= 20; });
    if (iAmClose) ranked.forEach((r) => { if (["freeze", "chaos", "double"].includes(r.card.type)) r.s += 20; });
    ranked.sort((a, b) => b.s - a.s);
    return ranked[0].card;
  }

  if (style === "comeback") {
    let ranked = playable.map((c) => ({ card: c, s: score(c) }));
    const iAmBehind = handSize > minOpp + 2;
    if (iAmBehind) {
      ranked.forEach((r) => { if (r.card.type === "number") r.s += 15; if (r.card.type === "colorShift" || r.card.type === "chaos") r.s -= 15; });
    } else {
      ranked.forEach((r) => { if (["freeze", "double", "chaos"].includes(r.card.type)) r.s += 18; });
    }
    ranked.sort((a, b) => b.s - a.s);
    return ranked[0].card;
  }

  // strategic (Sage / default)
  let ranked = playable.map((c) => ({ card: c, s: score(c) }));
  if (diff === "hard") {
    ranked.forEach((r) => {
      const hasColored = playable.some(c => c.color && c !== r.card);
      if ((r.card.type === "colorShift" || r.card.type === "chaos") && hasColored) r.s -= 18;
      if (underThreat && ["freeze", "double", "chaos"].includes(r.card.type)) r.s += 10;
      if (iAmClose && r.card.type === "number") r.s += 12;
    });
  }
  ranked.sort((a, b) => b.s - a.s);
  return ranked[0].card;
}

function chooseBotColor(hand, difficulty) {
  if (difficulty === "hard") {
    const counts = countColors(hand);
    let best = "red", bestN = -1;
    for (const k in counts) if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    return best;
  }
  if (difficulty === "normal") return mostCommonColor(hand);
  return CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
}

module.exports = { chooseBotCard, chooseBotColor, getPlayable, mostCommonColor, countColors };
