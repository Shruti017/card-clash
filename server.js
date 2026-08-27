/* =========================================================
   server.js  -  Express + Socket.IO + MongoDB (all optional)
   Bot mode works with NO database. Multiplayer + profiles
   use Socket.IO and MongoDB when available.
   ========================================================= */
require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const USE_MONGODB = process.env.USE_MONGODB !== "false";

// ---- Serve the front-end (works with or without a database) ----
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Simple health endpoint (used by analytics / connection checks).
app.get("/api/health", (req, res) => {
  res.json({ ok: true, mongo: mongoose.connection.readyState === 1 });
});

// ---------- Optional DB-backed API (requires MongoDB) ----------
const dbOK = () => {
  try { return mongoose.connection.readyState === 1; } catch (e) { return false; }
};

// Create-or-get a player profile.
app.post("/api/user", async (req, res) => {
  if (!dbOK()) return res.status(503).json({ error: "Database not available" });
  try {
    const { username, avatar } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    let user = await require("./server/models/User").findOne({ username });
    if (!user) {
      user = await require("./server/models/User").create({ username, avatar: avatar || "🙂" });
    }
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leaderboard: top players by total score.
app.get("/api/leaderboard", async (req, res) => {
  if (!dbOK()) return res.json([]);
  try {
    const users = await require("./server/models/User").find().sort({ totalScore: -1 }).limit(20);
    res.json(users);
  } catch (e) { res.json([]); }
});

// Game history (most recent first).
app.get("/api/history", async (req, res) => {
  if (!dbOK()) return res.json([]);
  try {
    const hist = await require("./server/models/GameHistory").find().sort({ createdAt: -1 }).limit(50);
    res.json(hist);
  } catch (e) { res.json([]); }
});

// Player profile + analytics insight.
app.get("/api/profile/:username", async (req, res) => {
  if (!dbOK()) return res.status(503).json({ error: "Database not available" });
  try {
    const user = await require("./server/models/User").findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rule-based analytics / advice for a player.
app.get("/api/analytics/:username", async (req, res) => {
  if (!dbOK()) return res.status(503).json({ error: "Database not available" });
  try {
    const user = await require("./server/models/User").findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "Not found" });
    const games = await require("./server/models/GameHistory").find({ "players.name": req.params.username });
    const winRate = user.gamesPlayed ? (user.gamesWon / user.gamesPlayed) * 100 : 0;
    let advice = "Keep playing to unlock insights!";
    if (winRate >= 60) advice = "You win often — try HARD difficulty to push further.";
    else if (winRate >= 40) advice = "Solid play. Save your Color Shift card for the final rounds.";
    else advice = "Tip: play number cards early and hold specials to block opponents.";
    res.json({
      username: user.username,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      winRate: Math.round(winRate * 10) / 10,
      bestScore: user.bestScore,
      currentStreak: user.currentStreak,
      advice
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Socket.IO (online multiplayer) ----
let io = null;
try {
  const { Server } = require("socket.io");
  io = new Server(server);
  require("./server/socket/gameSocket")(io);
} catch (e) {
  console.log("[socket] Socket.IO unavailable:", e.message);
}

// ---- MongoDB (optional) ----
async function connectDB() {
  if (!USE_MONGODB) {
    console.log("[db] MongoDB disabled by config (USE_MONGODB=false).");
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("[db] No MONGODB_URI set - running without database.");
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log("[db] Connected to MongoDB.");
  } catch (err) {
    console.log("[db] MongoDB connection failed - continuing without DB:", err.message);
  }
}

// Start listening, falling back to the next port if the requested
// one is already taken (so `npm start` never silently fails).
function startListening(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log("[server] Port " + port + " in use, trying " + (port + 1) + "...");
      startListening(port + 1);
    } else {
      console.error("[server] Failed to start:", err.message);
    }
  });
  server.listen(port, async () => {
    console.log("=========================================");
    console.log("  CARD CLASH running on port " + port);
    console.log("  Open: http://localhost:" + port);
    console.log("=========================================");
    await connectDB();
  });
}
startListening(PORT);

// Allow clean shutdown.
process.on("SIGINT", () => {
  mongoose.connection.close();
  server.close(() => process.exit(0));
});
