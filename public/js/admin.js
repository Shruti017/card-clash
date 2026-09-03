/* =========================================================
   admin.js - Admin panel logic
   ========================================================= */
(function () {
  const PASS = "admin123";
  let users = [], history = [];

  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  document.getElementById("refreshBtn").addEventListener("click", loadAll);
  document.getElementById("closeDetail").addEventListener("click", () => {
    document.getElementById("detailPanel").style.display = "none";
  });

  function login() {
    const val = document.getElementById("adminPass").value;
    if (val !== PASS) {
      document.getElementById("loginErr").style.display = "block";
      return;
    }
    document.getElementById("loginView").style.display = "none";
    document.getElementById("dashView").style.display = "block";
    loadAll();
  }

  async function loadAll() {
    try {
      const [uRes, hRes] = await Promise.all([
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/history").then(r => r.json())
      ]);
      users = Array.isArray(uRes) ? uRes : [];
      history = Array.isArray(hRes) ? hRes : [];
    } catch (e) {
      users = []; history = [];
    }
    renderStats();
    renderUsers();
    renderHistory();
  }

  function renderStats() {
    document.getElementById("statUsers").textContent = users.length;
    const totalGames = history.length;
    document.getElementById("statGames").textContent = totalGames;
    let totalWR = 0;
    users.forEach(u => {
      const wr = u.gamesPlayed ? (u.gamesWon / u.gamesPlayed) * 100 : 0;
      totalWR += wr;
    });
    document.getElementById("statWinRate").textContent = users.length ? Math.round(totalWR / users.length) + "%" : "0%";
    let best = 0;
    users.forEach(u => { if (u.bestScore > best) best = u.bestScore; });
    document.getElementById("statBest").textContent = best;
  }

  function renderUsers() {
    const tbody = document.getElementById("userTable");
    tbody.innerHTML = "";
    document.getElementById("noUsers").style.display = users.length ? "none" : "block";
    users.forEach(u => {
      const wr = u.gamesPlayed ? Math.round((u.gamesWon / u.gamesPlayed) * 1000) / 10 : 0;
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + (u.avatar || "🙂") + "</td>" +
        "<td><b>" + u.username + "</b></td>" +
        "<td>" + u.gamesPlayed + "</td>" +
        "<td>" + u.gamesWon + "</td>" +
        "<td>" + wr + "%</td>" +
        "<td>" + u.bestScore + "</td>" +
        '<td><div class="actions">' +
        '<button class="btn-sm view" data-user="' + u.username + '">View</button>' +
        '<button class="btn-sm del" data-id="' + u._id + '">Delete</button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".view").forEach(b => b.addEventListener("click", () => viewUser(b.dataset.user)));
    tbody.querySelectorAll(".del").forEach(b => b.addEventListener("click", () => deleteUser(b.dataset.id)));
  }

  function renderHistory() {
    const tbody = document.getElementById("histTable");
    tbody.innerHTML = "";
    document.getElementById("noHist").style.display = history.length ? "none" : "block";
    history.slice(0, 20).forEach(g => {
      const tr = document.createElement("tr");
      const date = new Date(g.createdAt).toLocaleDateString();
      const names = (g.players || []).map(p => p.name).join(", ");
      tr.innerHTML = "<td>" + date + "</td><td><b>" + (g.winner || "?") + "</b></td><td>" + names + "</td><td>" + (g.gameMode || "-") + "</td>";
      tbody.appendChild(tr);
    });
  }

  async function viewUser(username) {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "block";
    document.getElementById("detName").textContent = username;
    document.getElementById("detStats").innerHTML = "Loading...";
    document.getElementById("detAdvice").innerHTML = "";
    try {
      const [prof, anal] = await Promise.all([
        fetch("/api/profile/" + encodeURIComponent(username)).then(r => r.json()),
        fetch("/api/analytics/" + encodeURIComponent(username)).then(r => r.json())
      ]);
      const wr = prof.gamesPlayed ? Math.round((prof.gamesWon / prof.gamesPlayed) * 1000) / 10 : 0;
      document.getElementById("detStats").innerHTML =
        statCard("Games Played", prof.gamesPlayed) +
        statCard("Wins", prof.gamesWon) +
        statCard("Losses", prof.gamesLost) +
        statCard("Win Rate", wr + "%") +
        statCard("Best Score", prof.bestScore) +
        statCard("Streak", prof.currentStreak);
      document.getElementById("detAdvice").innerHTML =
        '<div class="advice-card"><h4>💡 Insight</h4><p>' + (anal.advice || "Play more games!") + '</p></div>';
    } catch (e) {
      document.getElementById("detStats").innerHTML = "<p style='opacity:0.5'>Could not load (MongoDB may be off).</p>";
    }
  }

  function statCard(label, val) {
    return '<div class="stat-item"><div class="sv">' + val + '</div><div class="sl">' + label + '</div></div>';
  }

  async function deleteUser(id) {
    if (!confirm("Delete this user?")) return;
    try {
      await fetch("/api/admin/users/" + id, { method: "DELETE" });
      loadAll();
    } catch (e) {}
  }
})();
