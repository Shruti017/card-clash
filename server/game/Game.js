/* =========================================================
   server/game/Game.js
   Authoritative multiplayer game state.
   The server NEVER trusts the client: it validates every
   move, controls the deck, turns, effects, and winner.
   ========================================================= */
const Deck = require("./Deck");
const Bot = require("./Bot");

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [];      // { id, name, isBot, personalityStyle, difficulty, hand:[] }
    this.deck = [];
    this.discard = [];
    this.turn = 0;
    this.direction = 1;
    this.started = false;
    this.gameOver = false;
    this.winnerId = null;
    this.scores = {};
    this.unoCalled = {};      // playerId -> true if UNO was called
    this.unoTimers = {};      // playerId -> timeout reference (for bots)
  }

  addPlayer(player) {
    this.players.push({
      id: player.id,
      name: player.name,
      isBot: !!player.isBot,
      personalityStyle: player.personalityStyle || null,
      difficulty: player.difficulty || "normal",
      hand: []
    });
    return this.players.length - 1;
  }

  removePlayer(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i !== -1) this.players.splice(i, 1);
    return i;
  }

  currentCard() { return this.discard[this.discard.length - 1]; }

  drawFromDeck() {
    if (this.deck.length === 0) {
      const top = this.discard.pop();
      this.deck = Deck.shuffle(this.discard);
      this.discard = [top];
    }
    return this.deck.pop();
  }

  start() {
    this.deck = Deck.shuffle(Deck.createDeck());
    this.players.forEach((p) => (p.hand = []));
    for (let r = 0; r < 7; r++) this.players.forEach((p) => p.hand.push(this.drawFromDeck()));

    let first = this.deck.pop();
    while (first && (first.type === "colorShift" || first.type === "chaos")) {
      this.deck.unshift(first);
      first = this.deck.pop();
    }
    this.discard.push(first);
    this.turn = 0;
    this.direction = 1;
    this.started = true;
    this.gameOver = false;
    this.winnerId = null;
  }

  advance(index, steps) {
    const n = this.players.length;
    return ((index + this.direction * steps) % n + n) % n;
  }

  playerById(id) { return this.players.find((p) => p.id === id); }
  playerIndex(id) { return this.players.findIndex((p) => p.id === id); }

  // ---- Validate + play ----
  playCard(playerId, cardId, chosenColor) {
    if (this.gameOver) return { ok: false, error: "Game is over" };
    const idx = this.playerIndex(playerId);
    if (idx === -1) return { ok: false, error: "Not a player" };
    if (idx !== this.turn) return { ok: false, error: "Not your turn" };

    const player = this.players[idx];
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) return { ok: false, error: "Card not in hand" };
    if (!Deck.canPlayCard(card, this.currentCard()))
      return { ok: false, error: "Card cannot be played" };

    // Remove and discard.
    player.hand = player.hand.filter((c) => c.id !== cardId);
    if (card.type === "colorShift" || card.type === "chaos") {
      if (!["red", "blue", "green", "yellow"].includes(chosenColor)) chosenColor = "red";
      card.chosenColor = chosenColor;
    }
    this.discard.push(card);

    // Winner.
    if (player.hand.length === 0) {
      this.gameOver = true;
      this.winnerId = playerId;
      this.computeScores();
      return { ok: true, winner: playerId };
    }

    // Apply effects.
    const type = card.type;
    if (type === "switch") {
      this.direction *= -1;
      this.turn = this.advance(idx, 1);
    } else if (type === "freeze") {
      this.turn = this.advance(idx, 2);
    } else if (type === "double") {
      const next = this.advance(idx, 1);
      this.giveCards(next, 2);
      this.turn = this.advance(idx, 2);
    } else if (type === "chaos") {
      const next = this.advance(idx, 1);
      this.giveCards(next, 4);
      this.turn = this.advance(idx, 2);
    } else {
      this.turn = this.advance(idx, 1);
    }
    return { ok: true };
  }

  drawCard(playerId) {
    if (this.gameOver) return { ok: false, error: "Game is over" };
    const idx = this.playerIndex(playerId);
    if (idx === -1) return { ok: false, error: "Not a player" };
    if (idx !== this.turn) return { ok: false, error: "Not your turn" };
    this.players[idx].hand.push(this.drawFromDeck());
    this.turn = this.advance(idx, 1);
    return { ok: true };
  }

  giveCards(idx, count) {
    for (let i = 0; i < count; i++) this.players[idx].hand.push(this.drawFromDeck());
  }

  // Decide a bot move. Returns { type:'play', cardId, chosenColor } or { type:'draw' }.
  botMove() {
    const bot = this.players[this.turn];
    if (!bot || !bot.isBot) return null;
    const oppCounts = this.players.filter((p) => p.id !== bot.id).map((p) => p.hand.length);
    const card = Bot.chooseBotCard(bot, bot.hand, this.currentCard(), oppCounts);
    if (!card) return { type: "draw" };
    if (card.type === "colorShift" || card.type === "chaos") {
      return { type: "play", cardId: card.id, chosenColor: Bot.chooseBotColor(bot.hand, bot.difficulty) };
    }
    return { type: "play", cardId: card.id };
  }

  computeScores() {
    this.scores = {};
    let total = 0;
    this.players.forEach((p) => {
      let s = 0;
      p.hand.forEach((c) => (s += c.points));
      this.scores[p.id] = s;
      total += s;
    });
    // Winner gets the sum of everyone else's points.
    if (this.winnerId) this.scores[this.winnerId] = total;
  }

  // Return state sanitized for a specific player (opponents' cards hidden).
  getState(forPlayerId) {
    return {
      roomId: this.roomId,
      started: this.started,
      gameOver: this.gameOver,
      winnerId: this.winnerId,
      scores: this.scores,
      turn: this.turn,
      direction: this.direction,
      current: this.currentCard(),
      deckCount: this.deck.length,
      discardCount: this.discard.length,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        handCount: p.hand.length,
        // Only send the actual cards to the owner.
        hand: p.id === forPlayerId ? p.hand : undefined
      }))
    };
  }

  // ---- UNO call rule (server-authoritative) ----
  callUno(playerId) {
    const idx = this.playerIndex(playerId);
    if (idx === -1) return { ok: false, error: "Not a player" };
    const p = this.players[idx];
    if (p.hand.length <= 1) {
      this.unoCalled[playerId] = true;
      if (this.unoTimers[playerId]) { clearTimeout(this.unoTimers[playerId]); delete this.unoTimers[playerId]; }
      return { ok: true };
    }
    return { ok: false, error: "Not eligible" };
  }

  // Called after every turn change. Checks if the current player needs to
  // call UNO (has 1 card). Bots auto-call instantly; humans get a 5s window.
  checkUno() {
    const p = this.players[this.turn];
    if (!p || p.hand.length !== 1) return null;
    if (this.unoCalled[p.id]) return null; // already called
    if (p.isBot) {
      this.unoCalled[p.id] = true;
      return { botCalled: p.name };
    }
    // Human: set a 5-second timer.
    if (this.unoTimers[p.id]) clearTimeout(this.unoTimers[p.id]);
    this.unoTimers[p.id] = setTimeout(() => {
      if (this.gameOver) return;
      if (!this.unoCalled[p.id] && p.hand.length === 1) {
        this.giveCards(this.playerIndex(p.id), 2);
        this.unoTimers[p.id] = null;
      }
    }, 5000);
    return { needsCall: p.id, name: p.name };
  }
}

module.exports = Game;
