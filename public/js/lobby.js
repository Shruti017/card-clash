/* =========================================================
   lobby.js - create/join room UI logic (multiplayer).
   ========================================================= */
(function () {
  const socket = window.CCSocket;
  const $ = (id) => document.getElementById(id);

  let myPid = null;
  let roomId = null;
  let selectedBots = 0;

  function showError(msg) {
    const box = $("errorBox");
    box.textContent = msg;
    box.classList.remove("hidden");
    setTimeout(() => box.classList.add("hidden"), 3000);
  }

  socket.on("errorMsg", (m) => showError(m));
  socket.on("roomCreated", ({ roomId: rid, playerId }) => {
    roomId = rid; myPid = playerId;
    $("roomCode").textContent = rid;
    $("roomPanel").classList.remove("hidden");
    $("startRow").classList.remove("hidden");
    $("waitMsg").classList.add("hidden");
  });
  socket.on("joinedRoom", ({ roomId: rid, playerId }) => {
    roomId = rid; myPid = playerId;
    $("roomCode").textContent = rid;
    $("roomPanel").classList.remove("hidden");
    $("waitMsg").textContent = "Waiting for host to start…";
  });

  socket.on("gameState", (state) => {
    renderPlayerList(state);
    if (state.started) {
      // Hand off to the multiplayer game view.
      window.CCGame.start(state, myPid, roomId);
    }
  });

  function renderPlayerList(state) {
    const list = $("playerList");
    list.innerHTML = "";
    state.players.forEach((p) => {
      const div = document.createElement("div");
      div.className = "pl-item";
      div.textContent = (p.isBot ? "🤖 " : "🙂 ") + p.name +
        (p.id === myPid ? " (you)" : "");
      list.appendChild(div);
    });
  }

  // Bots selector
  $("botRow").querySelectorAll(".choice").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("botRow").querySelectorAll(".choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedBots = parseInt(btn.dataset.value);
    });
  });

  $("createBtn").addEventListener("click", () => {
    const name = ($("nameInput").value || "Player").trim();
    socket.emit("createRoom", { name });
  });
  $("joinBtn").addEventListener("click", () => {
    const name = ($("nameInput").value || "Player").trim();
    const code = ($("codeInput").value || "").trim().toUpperCase();
    if (code.length < 4) return showError("Enter a valid room code");
    socket.emit("joinRoom", { roomId: code, name });
  });
  $("startBtn").addEventListener("click", () => {
    socket.emit("startGame", { bots: selectedBots });
  });
  $("copyBtn").addEventListener("click", () => {
    navigator.clipboard && navigator.clipboard.writeText(roomId);
    $("copyBtn").textContent = "Copied!";
    setTimeout(() => ($("copyBtn").textContent = "Copy"), 1200);
  });
})();
