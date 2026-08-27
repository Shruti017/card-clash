/* =========================================================
   server/models/GameHistory.js
   One record per finished game (used by History + Analytics).
   ========================================================= */
const mongoose = require("mongoose");

const GameHistorySchema = new mongoose.Schema({
  gameId: String,
  players: [{
    name: String,
    isBot: Boolean,
    score: Number
  }],
  winner: String,
  scores: Object,
  gameMode: { type: String, default: "multiplayer" },
  turns: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // seconds
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GameHistory", GameHistorySchema);
