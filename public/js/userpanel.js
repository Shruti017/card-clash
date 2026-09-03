/* =========================================================
   userpanel.js - User profile panel logic.
   Works with both MongoDB (online) and localStorage (bot mode).
   ========================================================= */
(function () {
  let username = null;

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("loadBtn").addEventListener("click", load);
  document.getElementById("userInput").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
  document.getElementById("changeUser").addEventListener("click", () => {
    document.getElementById("profileView").style.display = "none";
    document.getElementById("entryView").style.display = "block";
    username = null;
  });

  async function load() {
    username = (document.getElementById("userInput").value || "").trim();
    if (!username) return;

    // Ensure user exists in DB (if available).
    try {
      await fetch("/api/user", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, avatar: "🙂" })
      });
    } catch (e) {}

    // Load profile.
    let prof = null, hist = [], advice = "Play more games to unlock tips!";
    try {
      prof = await fetch("/api/profile/" + encodeURIComponent(username)).then(r => r.json());
    } catch (e) {}
    try {
      hist = await fetch("/api/history").then(r => r.json());
      hist = hist.filter(g => (g.players || []).some(p => p.name === username));
    } catch (e) {}
    try {
      const anal = await fetch("/api/analytics/" + encodeURIComponent(username)).then(r => r.json());
      if (anal.advice) advice = anal.advice;
    } catch (e) {}

    // Fallback: if no DB, use localStorage stats.
    if (!prof || prof.error) {
      prof = getLocalStats();
    }

    document.getElementById("entryView").style.display = "none";
    document.getElementById("profileView").style.display = "block";

    // Render profile header.
    document.getElementById("pName").textContent = username;
    document.getElementById("pAvatar").textContent = prof.avatar || "🙂";
    document.getElementById("pJoined").textContent = prof.createdAt ? "Joined " + new Date(prof.createdAt).toLocaleDateString() : "Playing locally";

    // Stats.
    const wr = prof.gamesPlayed ? Math.round((prof.gamesWon / prof.gamesPlayed) * 1000) / 10 : 0;
    document.getElementById("sPlayed").textContent = prof.gamesPlayed || 0;
    document.getElementById("sWon").textContent = prof.gamesWon || 0;
    document.getElementById("sLost").textContent = prof.gamesLost || 0;
    document.getElementById("sWR").textContent = wr + "%";
    document.getElementById("sBest").textContent = prof.bestScore || 0;
    document.getElementById("sStreak").textContent = prof.currentStreak || 0;
    document.getElementById("sTotal").textContent = prof.totalScore || 0;

    // History.
    const tbody = document.getElementById("pHistTable");
    tbody.innerHTML = "";
    document.getElementById("noPHist").style.display = hist.length ? "none" : "block";
    hist.slice(0, 20).forEach(g => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + new Date(g.createdAt).toLocaleDateString() + "</td>" +
        "<td><b>" + (g.winner || "?") + "</b></td>" +
        "<td>" + (g.players || []).map(p => p.name).join(", ") + "</td>" +
        "<td>" + (g.gameMode || "-") + "</td>";
      tbody.appendChild(tr);
    });

    // Insights.
    document.getElementById("pAdvice").textContent = advice;
    const perf = wr >= 60 ? "You're a strong player — try HARD difficulty!"
      : wr >= 40 ? "Solid play. Work on saving specials for late game."
      : "Tip: match colors first, save wild cards for when you have no other option.";
    document.getElementById("pPerf").textContent = perf;
  }

  function getLocalStats() {
    try {
      const s = JSON.parse(localStorage.getItem("cc_stats") || "{}");
      return {
        username: username, avatar: "🙂",
        gamesPlayed: s.games || 0, gamesWon: s.wins || 0,
        gamesLost: (s.games || 0) - (s.wins || 0),
        totalScore: s.totalScore || 0, bestScore: s.best || 0,
        currentStreak: s.streak || 0, createdAt: null
      };
    } catch (e) {
      return { username: username, avatar: "🙂", gamesPlayed: 0, gamesWon: 0, gamesLost: 0, totalScore: 0, bestScore: 0, currentStreak: 0 };
    }
  }
})();
