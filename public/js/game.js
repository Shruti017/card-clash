/* =========================================================
   game.js  -  Client-side game engine for BOT MODE.
   Reads ?bots=2|3&diff=easy|normal|hard from the URL.
   No server or database required to play this mode.
   ========================================================= */

(function () {
  const C = window.CardClash;
  const B = window.BotAI;

  // ---------- Read URL settings ----------
  const params = new URLSearchParams(location.search);
  const BOT_COUNT = parseInt(params.get("bots")) === 3 ? 3 : 2;
  const DIFFICULTY = ["easy", "normal", "hard"].includes(params.get("diff")) ? params.get("diff") : "normal";

  // ---------- Game state ----------
  const G = {
    players: [],     // index 0 = human, rest = bots
    deck: [],
    discard: [],
    turn: 0,
    direction: 1,    // 1 = forward, -1 = reversed
    gameOver: false,
    pendingWild: null // card waiting for a color choice (human)
  };

  // ---------- Setup ----------
  function setup() {
    G.deck = C.shuffle(C.createDeck());

    // Human player.
    G.players = [{
      idx: 0, name: "You", icon: "🙂", isBot: false, hand: []
    }];

    // Bot personalities (varied for replay interest).
    const botPlan = [
      { key: "blaze", style: "aggressive" },
      { key: "sage",  style: "strategic" },
      { key: "lucky", style: "unpredictable" }
    ];
    for (let i = 0; i < BOT_COUNT; i++) {
      const p = botPlan[i];
      const persona = B.BOT_PERSONALITIES[p.key];
      G.players.push({
        idx: i + 1,
        name: persona.name,
        icon: persona.icon,
        isBot: true,
        personality: { key: p.key, style: p.style },
        difficulty: DIFFICULTY,
        hand: []
      });
    }

    // Deal 7 cards to each player.
    for (let r = 0; r < 7; r++) {
      G.players.forEach((p) => p.hand.push(drawFromDeck()));
    }

    // Flip the first discard card (avoid starting on a wild).
    let first = G.deck.pop();
    while (first && (first.type === "colorShift" || first.type === "chaos")) {
      G.deck.unshift(first);          // put it back at the bottom
      first = G.deck.pop();
    }
    G.discard.push(first);
    G.turn = 0;
    G.direction = 1;
    G.gameOver = false;
    G.pendingWild = null;

    bindControls();
    renderAll();
  }

  // Pull a card from the deck, reshuffling the discard if empty.
  function drawFromDeck() {
    if (G.deck.length === 0) {
      // Keep the top discard, recycle the rest.
      const top = G.discard.pop();
      G.deck = C.shuffle(G.discard);
      G.discard = [top];
    }
    return G.deck.pop();
  }

  // ---------- Turn helpers ----------
  function advance(index, steps) {
    const n = G.players.length;
    return ((index + G.direction * steps) % n + n) % n;
  }

  function currentCard() { return G.discard[G.discard.length - 1]; }

  function opponentCounts() {
    // counts of opponents relative to the player whose turn it is NOT;
    // for bots we just pass all other players' hand sizes.
    return G.players.filter((p) => p.idx !== G.turn).map((p) => p.hand.length);
  }

  // ---------- Play a card ----------
  // playerIdx acts; card is the card object; chosenColor for wilds.
  function applyPlay(playerIdx, card, chosenColor) {
    const player = G.players[playerIdx];
    const handIdx = player.hand.findIndex((c) => c.id === card.id);
    if (handIdx === -1) return; // safety

    // Remove from hand, place on discard.
    player.hand.splice(handIdx, 1);
    if (card.type === "colorShift" || card.type === "chaos") {
      card.chosenColor = chosenColor || "red";
    }
    G.discard.push(card);

    Sound.play(card.type === "number" ? "play" : "special");

    // Winner?
    if (player.hand.length === 0) {
      renderAll();
      endGame(player);
      return;
    }

    // Apply special effects on turn order.
    const type = card.type;
    if (type === "switch") {
      G.direction *= -1;
      G.turn = advance(playerIdx, 1);
    } else if (type === "freeze") {
      G.turn = advance(playerIdx, 2); // skip next player
    } else if (type === "double") {
      const next = advance(playerIdx, 1);
      giveCards(next, 2);
      G.turn = advance(playerIdx, 2);
    } else if (type === "chaos") {
      const next = advance(playerIdx, 1);
      giveCards(next, 4);
      G.turn = advance(playerIdx, 2);
    } else {
      G.turn = advance(playerIdx, 1);
    }

    checkOneCard();
    renderAll();
    afterAction();
  }

  // Give `count` cards to a player (from deck).
  function giveCards(playerIdx, count) {
    for (let i = 0; i < count; i++) {
      G.players[playerIdx].hand.push(drawFromDeck());
    }
  }

  // ---------- One-card warning ----------
  function checkOneCard() {
    G.players.forEach((p) => {
      if (p.hand.length === 1) {
        showToast("⚠ " + (p.isBot ? p.name.toUpperCase() : "YOU") + " ONE CARD!");
        Sound.play("onecard");
      }
    });
  }

  // ---------- After an action, continue the game ----------
  function afterAction() {
    if (G.gameOver) return;
    const p = G.players[G.turn];
    if (p.isBot) {
      scheduleBotTurn();
    } else {
      // Human's turn.
      setStatus(0, "");
      renderAll();
    }
  }

  // ---------- Bot turn ----------
  function scheduleBotTurn() {
    const bot = G.players[G.turn];
    if (!bot || !bot.isBot) return;
    setStatus(bot.idx, "Thinking...");
    renderAll();
    const delay = 800 + Math.random() * 700; // 0.8 - 1.5s
    setTimeout(() => doBotTurn(bot), delay);
  }

  function doBotTurn(bot) {
    if (G.gameOver) return;
    const playable = B.getPlayable(bot.hand, currentCard());
    const state = { opponentCounts: opponentCounts() };

    if (playable.length === 0) {
      // Must draw.
      giveCards(bot.idx, 1);
      Sound.play("draw");
      setStatus(bot.idx, "");
      checkOneCard();
      G.turn = advance(bot.idx, 1);
      renderAll();
      afterAction();
      return;
    }

    const card = B.chooseBotCard(bot, bot.hand, currentCard(), state);
    if (!card) {
      // Defensive: draw if nothing chosen.
      giveCards(bot.idx, 1);
      G.turn = advance(bot.idx, 1);
      renderAll();
      afterAction();
      return;
    }

    if (card.type === "colorShift" || card.type === "chaos") {
      const color = B.chooseBotColor(bot.hand, bot.difficulty);
      applyPlay(bot.idx, card, color);
    } else {
      applyPlay(bot.idx, card, null);
    }
  }

  // ---------- Human interactions ----------
  function onCardClick(card) {
    if (G.gameOver || G.turn !== 0) return;
    if (!C.canPlayCard(card, currentCard())) {
      // illegal: small shake feedback
      showToast("Can't play that card");
      return;
    }
    Sound.play("click");

    if (card.type === "colorShift" || card.type === "chaos") {
      G.pendingWild = card;
      openColorPicker();
      return;
    }
    applyPlay(0, card, null);
  }

  function onDrawClick() {
    if (G.gameOver || G.turn !== 0) return;
    Sound.play("draw");
    giveCards(0, 1);
    checkOneCard();
    // Turn passes after drawing.
    G.turn = advance(0, 1);
    renderAll();
    afterAction();
  }

  // ---------- Color picker ----------
  function openColorPicker() {
    document.getElementById("colorOverlay").classList.add("show");
  }
  function closeColorPicker() {
    document.getElementById("colorOverlay").classList.remove("show");
  }
  function onColorPick(color) {
    if (!G.pendingWild) return;
    const card = G.pendingWild;
    G.pendingWild = null;
    closeColorPicker();
    applyPlay(0, card, color);
  }

  // ---------- End game / scoring ----------
  function endGame(winner) {
    G.gameOver = true;
    // Score = sum of all opponents' remaining card points.
    let score = 0;
    G.players.forEach((p) => {
      if (p.idx !== winner.idx) {
        p.hand.forEach((c) => (score += c.points));
      }
    });

    saveLocalStat(winner.idx === 0, score);

    const overlay = document.getElementById("winOverlay");
    const title = document.getElementById("winTitle");
    const sub = document.getElementById("winSub");
    const scoreEl = document.getElementById("winScore");

    if (winner.idx === 0) {
      title.textContent = "🏆 YOU WIN!";
      sub.textContent = "Congratulations!";
      Sound.play("win");
      launchConfetti();
    } else {
      title.textContent = winner.icon + " " + winner.name.toUpperCase() + " WINS!";
      sub.textContent = "Better luck next time!";
      Sound.play("lose");
    }
    scoreEl.textContent = "Score: " + score;
    overlay.classList.add("show");
  }

  // Save light local stats (used by Profile/Analytics later).
  function saveLocalStat(won, score) {
    try {
      const s = JSON.parse(localStorage.getItem("cc_stats") || "{}");
      s.games = (s.games || 0) + 1;
      s.wins = (s.wins || 0) + (won ? 1 : 0);
      s.best = Math.max(s.best || 0, score);
      s.totalScore = (s.totalScore || 0) + score;
      localStorage.setItem("cc_stats", JSON.stringify(s));
    } catch (e) {}
  }

  // ---------- Rendering ----------
  function setStatus(idx, msg) {
    G.players[idx]._status = msg;
  }

  function renderAll() {
    renderSeats();
    renderCenter();
    renderHand();
    renderBanner();
    renderDrawBtn();
  }

  function renderBanner() {
    const b = document.getElementById("turnBanner");
    if (G.gameOver) { b.textContent = "Game over"; return; }
    const p = G.players[G.turn];
    b.textContent = p.isBot ? p.icon + " " + p.name + " is thinking..." : "YOUR TURN";
  }

  function renderSeats() {
    // Map opponent indices to seat DOM elements.
    const opp = G.players.filter((p) => p.isBot);
    const seatIds = ["seat-top", "seat-left", "seat-right"];
    // Decide layout: 2 bots -> top + left; 3 bots -> top + left + right.
    const layout = BOT_COUNT === 2 ? ["seat-top", "seat-left"]
                                    : ["seat-top", "seat-left", "seat-right"];
    seatIds.forEach((id) => (document.getElementById(id).style.display = "none"));

    opp.forEach((p, i) => {
      const seatEl = document.getElementById(layout[i]);
      if (!seatEl) return;
      seatEl.style.display = "block";
      const active = (p.idx === G.turn && !G.gameOver);
      const warn = (p.hand.length === 1);
      seatEl.className = "seat" + (active ? " active" : "") + (warn ? " warn" : "");
      seatEl.innerHTML =
        '<div class="avatar">' + p.icon + '</div>' +
        '<div class="pname">' + p.name + '</div>' +
        '<div class="pcount">' + p.hand.length + ' Cards</div>' +
        '<div class="pstatus">' + (p._status || "") + '</div>' +
        '<div class="mini-hand">' + renderMiniHand(p.hand.length) + '</div>';
    });
  }

  // small card-backs to visualise an opponent's hand size.
  function renderMiniHand(count) {
    let html = "";
    const show = Math.min(count, 7);
    for (let i = 0; i < show; i++) html += '<span class="mini-card"></span>';
    return html;
  }

  function renderCenter() {
    const top = currentCard();
    document.getElementById("discardPile").innerHTML =
      C.renderCardHTML(top, {}) + "";
    const dp = document.getElementById("discardPile").firstChild;
    if (dp) dp.classList.add("pop");
    document.getElementById("drawPile").innerHTML = C.renderCardBackHTML();
  }

  function renderHand() {
    const handEl = document.getElementById("hand");
    handEl.innerHTML = "";
    const hand = G.players[0].hand;
    const n = hand.length;
    const mid = (n - 1) / 2;
    hand.forEach((card, i) => {
      const slot = document.createElement("div");
      slot.className = "card-slot";
      const angle = (i - mid) * 5;
      const liftY = Math.abs(i - mid) * 3;
      slot.style.transform = "rotate(" + angle + "deg) translateY(" + liftY + "px)";

      const playable = (G.turn === 0 && !G.gameOver) && C.canPlayCard(card, currentCard());
      slot.innerHTML = C.renderCardHTML(card, { playable });

      if (playable) {
        const cardEl = slot.querySelector(".card");
        cardEl.addEventListener("click", () => onCardClick(card));
        cardEl.addEventListener("mouseenter", () => slot.classList.add("lift"));
        cardEl.addEventListener("mouseleave", () => slot.classList.remove("lift"));
      }
      handEl.appendChild(slot);
    });
  }

  function renderDrawBtn() {
    const btn = document.getElementById("drawBtn");
    const myTurn = (G.turn === 0 && !G.gameOver);
    btn.disabled = !myTurn;
    btn.classList.toggle("disabled", !myTurn);
  }

  // ---------- Controls / buttons ----------
  function bindControls() {
    document.getElementById("drawBtn").addEventListener("click", onDrawClick);
    document.getElementById("drawPile").addEventListener("click", () => {
      if (G.turn === 0 && !G.gameOver) onDrawClick();
    });
    document.querySelectorAll(".color-btn").forEach((b) => {
      b.addEventListener("click", () => { Sound.play("click"); onColorPick(b.dataset.color); });
    });
    document.getElementById("playAgainBtn").addEventListener("click", () => {
      Sound.play("click");
      document.getElementById("winOverlay").classList.remove("show");
      resetGame();
    });
    document.getElementById("winMenuBtn").addEventListener("click", () => {
      Sound.play("click");
      location.href = "index.html";
    });
    document.getElementById("menuBtn").addEventListener("click", () => {
      Sound.play("click");
      location.href = "index.html";
    });
    const sb = document.getElementById("soundBtn");
    sb.addEventListener("click", () => {
      Sound.enabled = !Sound.enabled;
      sb.textContent = Sound.enabled ? "🔊 Sound" : "🔇 Muted";
      if (Sound.enabled) Sound.play("click");
    });
  }

  function resetGame() {
    // Re-run setup with the same settings.
    G.players = [];
    setup();
  }

  // ---------- Go! ----------
  setup();
})();
