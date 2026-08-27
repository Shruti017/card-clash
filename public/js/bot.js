/* =========================================================
   bot.js  -  AI opponents (Blaze / Sage / Lucky)
   Difficulty: EASY / NORMAL / HARD
   Pure client code; same rules as the human player.
   ========================================================= */

const BOT_PERSONALITIES = {
  blaze: { name: "Blaze", icon: "🔥", style: "aggressive" },
  sage:  { name: "Sage",  icon: "🧠", style: "strategic" },
  lucky: { name: "Lucky", icon: "🍀", style: "unpredictable" }
};

// Pick the most common color in a hand (ignores wilds).
function mostCommonColor(hand) {
  const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => { if (c.color) counts[c.color]++; });
  let best = null, bestN = -1;
  for (const k in counts) {
    if (counts[k] > bestN) { bestN = counts[k]; best = k; }
  }
  return best || "red";
}

// Filter playable cards from a hand.
function getPlayable(hand, current) {
  return hand.filter((c) => window.CardClash.canPlayCard(c, current));
}

/* ---------------------------------------------------------
   chooseBotColor
   Decide which color to call after playing a wild.
   --------------------------------------------------------- */
function chooseBotColor(hand, difficulty) {
  if (difficulty === "hard" || difficulty === "normal") {
    return mostCommonColor(hand);
  }
  // Easy / lucky: random-ish.
  const cols = window.CardClash.CARD_COLORS;
  return cols[Math.floor(Math.random() * cols.length)];
}

/* ---------------------------------------------------------
   chooseBotCard
   Returns a card object to play, or null to draw.
   --------------------------------------------------------- */
function chooseBotCard(bot, hand, current, state) {
  const playable = getPlayable(hand, current);
  if (playable.length === 0) return null; // must draw

  const style = bot.personality.style;
  const diff = bot.difficulty;

  // ---- LUCKY: unpredictable ----
  if (style === "unpredictable") {
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // ---- EASY: first playable (simple) ----
  if (diff === "easy") {
    return playable[0];
  }

  // Determine threat: opponent with fewest cards.
  const minOpp = Math.min.apply(null, state.opponentCounts);
  const underThreat = minOpp <= 2;

  // Score each playable card.
  function score(card) {
    let s = 0;
    if (card.type === "number") {
      // Getting rid of high numbers is good.
      s += card.value + 2;
    } else if (card.type === "freeze" || card.type === "switch" || card.type === "double") {
      s += 12;
      // Extra value when an opponent is close to winning.
      if (underThreat) s += 25;
    } else if (card.type === "colorShift") {
      s += 6; // useful but keep wilds a bit longer
      if (underThreat) s += 10;
    } else if (card.type === "chaos") {
      s += 8;
      if (underThreat) s += 30; // best blocker
    }
    return s;
  }

  // ---- BLAZE (aggressive): loves attacking cards ----
  if (style === "aggressive") {
    // Prefer the most damaging card, but still play numbers to reduce hand.
    playable.sort((a, b) => score(b) - score(a));
    // If not under threat and we have numbers, sometimes just dump a number.
    if (!underThreat && Math.random() < 0.4 && playable.some(c => c.type === "number")) {
      return playable.find(c => c.type === "number");
    }
    return playable[0];
  }

  // ---- SAGE / default strategic (NORMAL / HARD) ----
  // HARD additionally avoids wasting wilds early and picks the card that
  // keeps the most options open.
  let ranked = playable.map((c) => ({ card: c, s: score(c) }));

  if (diff === "hard") {
    // Penalise using wilds if we still have colored cards to play.
    const hasColored = playable.some((c) => c.color);
    ranked.forEach((r) => {
      if ((r.card.type === "colorShift" || r.card.type === "chaos") && hasColored) {
        r.s -= 18;
      }
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
  getPlayable
};
