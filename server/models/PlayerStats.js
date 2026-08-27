/* =========================================================
   server/models/PlayerStats.js
   Aggregated analytics for a player (computed / cached).
   ========================================================= */
const mongoose = require("mongoose");

const PlayerStatsSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  winRate: { type: Number, default: 0 },
  favoriteColor: { type: String, default: "red" },
  favoriteCard: { type: String, default: "number" },
  averageScore: { type: Number, default: 0 },
  averageGameDuration: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("PlayerStats", PlayerStatsSchema);
