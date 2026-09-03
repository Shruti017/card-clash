/* =========================================================
   main.js - main menu interactions
   ========================================================= */
(function () {
  const botPanel = document.getElementById("botPanel");
  const netPanel = document.getElementById("netPanel");
  const openBot = document.getElementById("openBot");
  const openNet = document.getElementById("openNet");

  // Selected options.
  const sel = { bots: "2", diff: "normal" };

  function show(panel) {
    botPanel.style.display = "none";
    netPanel.style.display = "none";
    if (panel) panel.style.display = "block";
  }

  openBot.addEventListener("click", () => { beep(); show(botPanel); });
  openNet.addEventListener("click", () => { beep(); show(netPanel); });
  document.getElementById("quickPlay").addEventListener("click", () => { beep(); location.href = "game.html?bots=2&diff=normal"; });
  document.getElementById("botCancel").addEventListener("click", () => { beep(); show(null); });
  document.getElementById("netCancel").addEventListener("click", () => { beep(); show(null); });

  // Choice buttons (bots count + difficulty).
  document.querySelectorAll(".choice-row").forEach((row) => {
    const group = row.dataset.group;
    row.querySelectorAll(".choice").forEach((btn) => {
      // pre-select default
      if (btn.dataset.value === sel[group]) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        beep();
        row.querySelectorAll(".choice").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        sel[group] = btn.dataset.value;
      });
    });
  });

  document.getElementById("botStart").addEventListener("click", () => {
    beep();
    location.href = "game.html?bots=" + sel.bots + "&diff=" + sel.diff;
  });

  document.getElementById("netGo").addEventListener("click", () => {
    beep();
    location.href = "lobby.html";
  });

  function beep() {
    // Light click via WebAudio (no asset needed).
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = 420; g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.06);
    } catch (e) {}
  }
})();
