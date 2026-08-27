/* =========================================================
   server/socket/gameSocket.js
   Real-time multiplayer: rooms, turns, bots, persistence.
   Server-authoritative: all moves validated by Game.js.
   ========================================================= */
const Game = require("../game/Game");
const crypto = require("crypto");

const rooms = new Map(); // roomId -> { game, sockets:Map(socketId->playerId), hostId }

function makeRoomId() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A1B2C3"
}

function dbConnected() {
  try { return require("mongoose").connection.readyState === 1; }
  catch (e) { return false; }
}

function botPersonalities() {
  return [
    { name: "Blaze", personalityStyle: "aggressive", difficulty: "normal" },
    { name: "Sage",  personalityStyle: "strategic",  difficulty: "normal" },
    { name: "Lucky", personalityStyle: "unpredictable", difficulty: "normal" }
  ];
}

// Persist a finished game to MongoDB (if available).
async function recordHistory(game, mode) {
  if (!dbConnected()) return;
  try {
    const { GameHistory } = require("../models/GameHistory");
    await GameHistory.create({
      gameId: game.roomId,
      players: game.players.map((p) => ({ name: p.name, isBot: p.isBot, score: game.scores[p.id] || 0 })),
      winner: game.players.find((p) => p.id === game.winnerId)?.name || "?",
      scores: game.scores,
      gameMode: mode,
      turns: 0,
      duration: Math.round((Date.now() - (game._startedAt || Date.now())) / 1000)
    });
  } catch (e) { /* ignore */ }
}

function emitState(io, room) {
  room.game.players.forEach((p) => {
    const sockId = [...room.sockets.entries()].find(([, pid]) => pid === p.id)?.[0];
    if (sockId) io.to(sockId).emit("gameState", room.game.getState(p.id));
  });
}

// Drive bot turns sequentially with realistic delays.
function scheduleBots(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const game = room.game;
  if (game.gameOver) return;
  const cur = game.players[game.turn];
  if (!cur || !cur.isBot) return;

  const delay = 800 + Math.random() * 700;
  setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r || r.game.gameOver) return;
    const g = r.game;
    const move = g.botMove();
    if (!move) return;
    if (move.type === "draw") {
      g.drawCard(cur.id);
    } else {
      g.playCard(cur.id, move.cardId, move.chosenColor);
    }
    emitState(io, r);
    if (g.gameOver) { recordHistory(g, "multiplayer"); return; }
    scheduleBots(io, roomId); // chain to next bot if needed
  }, delay);
}

module.exports = function (io) {
  io.on("connection", (socket) => {
    let myRoomId = null;

    socket.on("createRoom", ({ name }) => {
      const roomId = makeRoomId();
      const game = new Game(roomId);
      game._startedAt = Date.now();
      const pid = "p_" + socket.id;
      game.addPlayer({ id: pid, name: name || "Player" });
      const room = { game, sockets: new Map([[socket.id, pid]]), hostId: pid };
      rooms.set(roomId, room);
      myRoomId = roomId;
      socket.join(roomId);
      socket.emit("roomCreated", { roomId, playerId: pid });
      emitState(io, room);
    });

    socket.on("joinRoom", ({ roomId, name }) => {
      const room = rooms.get(roomId);
      if (!room) { socket.emit("errorMsg", "Room not found"); return; }
      if (room.game.started) { socket.emit("errorMsg", "Game already started"); return; }
      if (room.game.players.length >= 4) { socket.emit("errorMsg", "Room is full"); return; }
      const pid = "p_" + socket.id;
      room.game.addPlayer({ id: pid, name: name || "Player" });
      room.sockets.set(socket.id, pid);
      myRoomId = roomId;
      socket.join(roomId);
      socket.emit("joinedRoom", { roomId, playerId: pid });
      emitState(io, room);
    });

    // Host starts the game. Bots can be added to fill the room.
    socket.on("startGame", ({ bots = 0 } = {}) => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const hostPid = room.sockets.get(socket.id);
      if (hostPid !== room.hostId) { socket.emit("errorMsg", "Only host can start"); return; }
      if (room.game.started) return;

      // Add requested bots (server-controlled players).
      const personas = botPersonalities();
      for (let i = 0; i < bots && room.game.players.length < 4; i++) {
        const persona = personas[i % personas.length];
        room.game.addPlayer({
          id: "bot_" + i + "_" + room.game.roomId,
          name: persona.name, isBot: true,
          personalityStyle: persona.personalityStyle, difficulty: persona.difficulty
        });
      }
      if (room.game.players.length < 2) {
        socket.emit("errorMsg", "Need at least 2 players"); return;
      }
      room.game.start();
      emitState(io, room);
      scheduleBots(io, myRoomId);
    });

    socket.on("playCard", ({ cardId, chosenColor }) => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const pid = room.sockets.get(socket.id);
      const res = room.game.playCard(pid, cardId, chosenColor);
      if (!res.ok) { socket.emit("errorMsg", res.error); return; }
      if (res.needColor) {
        room.game._pendingWild = room.game._pendingWild || {};
        room.game._pendingWild[pid] = cardId;
        emitState(io, room);
        return;
      }
      emitState(io, room);
      if (room.game.gameOver) { recordHistory(room.game, "multiplayer"); return; }
      scheduleBots(io, myRoomId);
    });

    socket.on("chooseColor", ({ color }) => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const pid = room.sockets.get(socket.id);
      const pending = room.game._pendingWild && room.game._pendingWild[pid];
      if (!pending) return;
      delete room.game._pendingWild[pid];
      const res = room.game.playCard(pid, pending, color);
      if (!res.ok) { socket.emit("errorMsg", res.error); return; }
      emitState(io, room);
      if (room.game.gameOver) { recordHistory(room.game, "multiplayer"); return; }
      scheduleBots(io, myRoomId);
    });

    socket.on("drawCard", () => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const pid = room.sockets.get(socket.id);
      const res = room.game.drawCard(pid);
      if (!res.ok) { socket.emit("errorMsg", res.error); return; }
      emitState(io, room);
      scheduleBots(io, myRoomId);
    });

    socket.on("restartGame", () => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      room.game.start();
      emitState(io, room);
      scheduleBots(io, myRoomId);
    });

    socket.on("disconnect", () => {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const pid = room.sockets.get(socket.id);
      room.sockets.delete(socket.id);
      if (pid) {
        const wasTurn = room.game.turn === room.game.playerIndex(pid);
        room.game.removePlayer(pid);
        if (wasTurn) room.game.turn = Math.max(0, room.game.turn % Math.max(1, room.game.players.length));
      }
      if (room.sockets.size === 0 && room.game.players.filter((p) => !p.isBot).length === 0) {
        rooms.delete(myRoomId);
      } else {
        emitState(io, room);
      }
    });
  });
};
