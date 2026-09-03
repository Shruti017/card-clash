/* =========================================================
   mpgame.js - Multiplayer game rendering + controls.
   Driven entirely by server (authoritative) gameState.
   ========================================================= */
(function () {
  const C = window.CardClash;
  const socket = window.CCSocket;

  let myPid = null;
  let roomId = null;
  let lastState = null;
  let warned = {}; // throttle one-card toasts per player id

  function show(view) {
    document.getElementById("lobbyView").style.display = view === "game" ? "none" : "flex";
    document.getElementById("mpView").style.display = view === "game" ? "flex" : "none";
  }

  function start(state, pid, rid) {
    myPid = pid; roomId = rid;
    show("game");
    bindControls();
    render(state);
  }

  function bindControls() {
    if (start._bound) return; start._bound = true;
    document.getElementById("mpDrawBtn").addEventListener("click", () => {
      if (!lastState || !isMyTurn()) return;
      Sound.play("draw");
      socket.emit("drawCard", {});
    });
    document.getElementById("mpUnoBtn").addEventListener("click", () => {
      socket.emit("callUno", {});
      document.getElementById("mpUnoBtn").style.display = "none";
      Sound.play("uno");
      showToast("🎉 YOU CALLED UNO!");
    });
    document.getElementById("mpDrawPile").addEventListener("click", () => {
      if (isMyTurn()) socket.emit("drawCard", {});
    });
    document.querySelectorAll("#mpColorOverlay .color-btn").forEach((b) => {
      b.addEventListener("click", () => {
        Sound.play("click");
        document.getElementById("mpColorOverlay").classList.remove("show");
        socket.emit("playCard", { cardId: pendingWild, chosenColor: b.dataset.color });
        pendingWild = null;
      });
    });
    document.getElementById("mpAgainBtn").addEventListener("click", () => {
      Sound.play("click");
      document.getElementById("mpWinOverlay").classList.remove("show");
      socket.emit("restartGame", {});
    });
    document.getElementById("mpWinMenu").addEventListener("click", () => location.href = "index.html");
    document.getElementById("mpMenuBtn").addEventListener("click", () => location.href = "index.html");
    const sb = document.getElementById("mpSoundBtn");
    sb.addEventListener("click", () => {
      Sound.enabled = !Sound.enabled;
      sb.textContent = Sound.enabled ? "🔊 Sound" : "🔇 Muted";
    });
  }

  let pendingWild = null;

  function isMyTurn() {
    if (!lastState) return false;
    const idx = lastState.players.findIndex((p) => p.id === myPid);
    return lastState.turn === idx && !lastState.gameOver;
  }

  function render(state) {
    lastState = state;
    const players = state.players;
    const localIdx = players.findIndex((p) => p.id === myPid);
    const local = players[localIdx];
    const myTurn = isMyTurn();

    // Banner
    const banner = document.getElementById("mpBanner");
    if (state.gameOver) banner.textContent = "Game over";
    else {
      const cur = players[state.turn];
      banner.textContent = myTurn ? "YOUR TURN" : (cur.isBot ? "🤖 " + cur.name : cur.name) + " is thinking...";
    }

    // Seats (opponents)
    const opp = players.filter((p) => p.id !== myPid);
    const layout = opp.length === 1 ? ["seat-top"]
      : opp.length === 2 ? ["seat-top", "seat-left"]
      : ["seat-top", "seat-left", "seat-right"];
    ["seat-top", "seat-left", "seat-right"].forEach((id) => (document.getElementById(id).style.display = "none"));
    opp.forEach((p, i) => {
      const el = document.getElementById(layout[i]); if (!el) return;
      el.style.display = "block";
      const active = (players[state.turn] && players[state.turn].id === p.id && !state.gameOver);
      const warn = p.handCount === 1;
      el.className = "seat" + (active ? " active" : "") + (warn ? " warn" : "");
      el.innerHTML =
        '<div class="avatar">' + (p.isBot ? "🤖" : "🙂") + '</div>' +
        '<div class="pname">' + p.name + '</div>' +
        '<div class="pcount">' + p.handCount + ' Cards</div>';
      // one-card toast (throttled)
      if (warn && !warned[p.id]) { showToast("⚠ " + p.name.toUpperCase() + " ONE CARD!"); Sound.play("onecard"); warned[p.id] = true; }
      if (!warn) warned[p.id] = false;
    });

    // Center
    const mpDiscard = document.getElementById("mpDiscard");
    mpDiscard.innerHTML = C.renderCardHTML(state.current, {});
    const dp = mpDiscard.querySelector(".card, .card-back"); if (dp) dp.classList.add("pop");
    document.getElementById("mpDrawPile").innerHTML = C.renderCardBackHTML();

    // Local hand
    const handEl = document.getElementById("mpHand");
    handEl.innerHTML = "";
    const hand = local.hand || [];
    const n = hand.length; const mid = (n - 1) / 2;
    hand.forEach((card, i) => {
      const slot = document.createElement("div");
      slot.className = "card-slot";
      slot.style.transform = "rotate(" + (i - mid) * 5 + "deg) translateY(" + Math.abs(i - mid) * 3 + "px)";
      const playable = myTurn && C.canPlayCard(card, state.current);
      if (handCountWarn(local)) {} // noop
      slot.innerHTML = C.renderCardHTML(card, { playable });
      if (playable) {
        const cardEl = slot.querySelector(".card");
        cardEl.addEventListener("mouseenter", () => slot.classList.add("lift"));
        cardEl.addEventListener("mouseleave", () => slot.classList.remove("lift"));
        cardEl.addEventListener("click", () => onCardClick(card));
      }
      handEl.appendChild(slot);
    });
    if (local.handCount === 1) { if (!warned[myPid]) { showToast("⚠ YOU ONE CARD!"); Sound.play("onecard"); warned[myPid] = true; } }
    else warned[myPid] = false;

    // Draw button
    const db = document.getElementById("mpDrawBtn");
    db.disabled = !myTurn; db.classList.toggle("disabled", !myTurn);

    // UNO button
    const unoBtn = document.getElementById("mpUnoBtn");
    if (local.hand && local.hand.length <= 1 && myTurn) {
      unoBtn.style.display = "inline-block";
    } else {
      unoBtn.style.display = "none";
    }

    // Win
    if (state.gameOver) showWin(state, local);
  }

  function handCountWarn(local) { return false; }

  function onCardClick(card) {
    if (!isMyTurn()) return;
    if (!C.canPlayCard(card, lastState.current)) { showToast("Can't play that card"); return; }
    Sound.play("click");
    if (card.type === "colorShift" || card.type === "chaos") {
      pendingWild = card.id;
      document.getElementById("mpColorOverlay").classList.add("show");
      return;
    }
    socket.emit("playCard", { cardId: card.id, chosenColor: null });
  }

  function showWin(state, local) {
    const overlay = document.getElementById("mpWinOverlay");
    if (overlay.classList.contains("show")) return;
    const won = state.winnerId === myPid;
    document.getElementById("mpWinTitle").textContent = won ? "🏆 YOU WIN!" : "🤖 " + (state.players.find((p) => p.id === state.winnerId)?.name || "Opponent") + " WINS!";
    document.getElementById("mpWinSub").textContent = won ? "Congratulations!" : "Better luck next time!";
    document.getElementById("mpWinScore").textContent = "Score: " + (state.scores[myPid] || 0);
    overlay.classList.add("show");
    if (won) { Sound.play("win"); launchConfetti(); } else Sound.play("lose");
  }

  socket.on("gameState", (state) => {
    if (document.getElementById("mpView").style.display !== "none") render(state);
  });

  socket.on("unoCalled", (data) => {
    showToast(data.name.toUpperCase() + " CALLS UNO!");
    Sound.play("uno");
  });

  socket.on("unoChallenge", (data) => {
    if (data.playerId === myPid) {
      showToast("⏰ CALL UNO! You have 5 seconds!");
    } else {
      showToast(data.name + " needs to call UNO!");
    }
  });

  window.CCGame = { start, render };
})();
