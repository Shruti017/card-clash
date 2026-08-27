/* =========================================================
   server/models/User.js
   Player profile + lifetime stats.
   ========================================================= */
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  avatar: { type: String, default: "🙂" },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  gamesLost: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
