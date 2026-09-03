/* =========================================================
   bot.js  -  AI opponents with enhanced personalities.
   Blaze (aggressive), Sage (strategic), Lucky (unpredictable),
   Shadow (sneaky / combo), Phoenix (comeback specialist).
   Difficulty: EASY / NORMAL / HARD
   ========================================================= */

const BOT_PERSONALITIES = {
  blaze:  { name: "Blaze",  icon: "🔥", style: "aggressive" },
  sage:   { name: "Sage",   icon: "🧠", style: "strategic" },
  lucky:  { name: "Lucky",  icon: "🍀", style: "unpredictable" },
  shadow: { name: "Shadow", icon: "🌑", style: "sneaky" },
  phoenix:{ name: "Phoenix",icon: "🐦", style: "comeback" }
};

function mostCommonColor(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  let best = null, bestN = -1;
  for (const k in counts) { if (counts[k] > bestN) { bestN = counts[k]; best = k; } }
  return best || "red";
}

function countColors(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  return counts;
}

function getPlayable(hand, current) {
  return hand.filter((c) => window.CardClash.canPlayCard(c, current));
}

function chooseBotColor(hand, difficulty) {
  if (difficulty === "hard") {
    // Pick the color that gives us the longest potential run.
    const counts = countColors(hand);
    let best = "red", bestN = -1;
    for (const k in counts) { if (counts[k] > bestN) { bestN = counts[k]; best = k; } }
    return best;
  }
  if (difficulty === "normal") return mostCommonColor(hand);
  return window.CardClash.CARD_COLORS[Math.floor(Math.random() * 4)];
}

function chooseBotCard(bot, hand, current, state) {
  const playable = getPlayable(hand, current);
  if (playable.length === 0) return null;

  const style = bot.personality.style;
  const diff = bot.difficulty;
  const handSize = hand.length;
  const minOpp = Math.min.apply(null, state.opponentCounts);
  const underThreat = minOpp <= 2;
  const iAmClose = handSize <= 3;

  // ---- EASY: first playable ----
  if (diff === "easy") return playable[0];

  // ---- LUCKY: random ----
  if (style === "unpredictable") return playable[Math.floor(Math.random() * playable.length)];

  // ---- SHARED SCORING ----
  function score(card) {
    let s = 0;
    if (card.type === "number") {
      s += card.value + 2;
      // Bonus: playing a number that matches many cards in our hand.
      if (countColors(hand)[card.color] >= 3) s += 5;
    } else if (card.type === "freeze" || card.type === "switch" || card.type === "double") {
      s += 12;
      if (underThreat) s += 25;
      if (iAmClose) s += 8; // push advantage when close to winning
    } else if (card.type === "colorShift") {
      s += 6;
      if (underThreat) s += 10;
      // HARD: prefer wilds when no good colored play exists.
      if (diff === "hard" && !playable.some(c => c.color && c !== card)) s += 12;
    } else if (card.type === "chaos") {
      s += 8;
      if (underThreat) s += 30;
      if (iAmClose) s += 15;
    }
    return s;
  }

  // ---- BLAZE (aggressive): attack-heavy ----
  if (style === "aggressive") {
    playable.sort((a, b) => score(b) - score(a));
    if (!underThreat && Math.random() < 0.4 && playable.some(c => c.type === "number")) {
      return playable.find(c => c.type === "number");
    }
    return playable[0];
  }

  // ---- SHADOW (sneaky): waits, then combos ----
  if (style === "sneaky") {
    let ranked = playable.map((c) => ({ card: c, s: score(c) }));
    // Hoard wilds if hand is large.
    if (handSize > 5) {
      ranked.forEach((r) => {
        if (r.card.type === "colorShift" || r.card.type === "chaos") r.s -= 20;
      });
    }
    // When close to winning, go aggressive.
    if (iAmClose) {
      ranked.forEach((r) => {
        if (r.card.type === "freeze" || r.card.type === "chaos" || r.card.type === "double") r.s += 20;
      });
    }
    ranked.sort((a, b) => b.s - a.s);
    return ranked[0].card;
  }

  // ---- PHOENIX (comeback): conservation when behind, aggression when ahead ----
  if (style === "comeback") {
    let ranked = playable.map((c) => ({ card: c, s: score(c) }));
    const iAmBehind = handSize > minOpp + 2;
    if (iAmBehind) {
      // Conserve specials, play numbers to reduce hand quickly.
      ranked.forEach((r) => {
        if (r.card.type === "number") r.s += 15;
        if (r.card.type === "colorShift" || r.card.type === "chaos") r.s -= 15;
      });
    } else {
      // Aggressive when ahead or tied.
      ranked.forEach((r) => {
        if (r.card.type === "freeze" || r.card.type === "double" || r.card.type === "chaos") r.s += 18;
      });
    }
    ranked.sort((a, b) => b.s - a.s);
    return ranked[0].card;
  }

  // ---- SAGE (strategic) / NORMAL+HARD default ----
  let ranked = playable.map((c) => ({ card: c, s: score(c) }));

  if (diff === "hard") {
    ranked.forEach((r) => {
      const hasColored = playable.some((c) => c.color && c !== r.card);
      if ((r.card.type === "colorShift" || r.card.type === "chaos") && hasColored) r.s -= 18;
      // Target weakest opponent (fewest cards) with specials.
      if (underThreat && (r.card.type === "freeze" || r.card.type === "double" || r.card.type === "chaos")) r.s += 10;
      // When close to winning, just dump the highest-value card.
      if (iAmClose && r.card.type === "number") r.s += 12;
    });
  }

  ranked.sort((a, b) => b.s - a.s);
  return ranked[0].card;
}

window.BotAI = {
  BOT_PERSONALITIES,
  chooseBotCard,
  chooseBotColor,
  mostCommonColor,
  countColors,
  getPlayable
};
