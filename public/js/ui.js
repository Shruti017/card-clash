/* =========================================================
   ui.js  -  Small UI helpers: sound, toast, confetti.
   All sounds are generated with the Web Audio API so the
   game needs ZERO external asset files.
   ========================================================= */

const Sound = {
  enabled: true,
  ctx: null,
  // Lazily create the audio context (browsers require a user gesture first).
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  // Play a tone. type = 'sine'|'square'|'triangle', freq in Hz, dur in seconds.
  tone(freq, dur, type, vol) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.value = vol == null ? 0.08 : vol;
    o.connect(g); g.connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  },
  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case "click":   this.tone(440, 0.08, "square", 0.05); break;
      case "play":    this.tone(520, 0.12, "triangle"); break;
      case "draw":    this.tone(300, 0.15, "sine", 0.06); break;
      case "special": this.tone(660, 0.18, "sawtooth", 0.06); break;
      case "turn":    this.tone(380, 0.1, "sine", 0.05); break;
      case "onecard": this.tone(880, 0.25, "square", 0.07); break;
      case "win":     this.tone(700, 0.5, "triangle", 0.09);
                      setTimeout(() => this.tone(900, 0.5, "triangle", 0.09), 180); break;
      case "lose":    this.tone(200, 0.6, "sawtooth", 0.08); break;
    }
  }
};

// Show a temporary toast message.
function showToast(msg, ms) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), ms || 1400);
}

// Simple DOM confetti for the win screen.
function launchConfetti() {
  const colors = ["#ffe07a", "#e23b3b", "#2f7be2", "#2faf5a", "#f2c12e"];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("div");
    c.style.position = "fixed";
    c.style.width = "10px"; c.style.height = "14px";
    c.style.background = colors[i % colors.length];
    c.style.left = Math.random() * 100 + "vw";
    c.style.top = "-20px";
    c.style.zIndex = 400;
    c.style.opacity = 0.9;
    c.style.borderRadius = "2px";
    c.style.pointerEvents = "none";
    document.body.appendChild(c);
    const fall = 400 + Math.random() * 400;
    const drift = (Math.random() - 0.5) * 200;
    c.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
      ],
      { duration: 1800 + Math.random() * 1200, easing: "ease-in" }
    ).onfinish = () => c.remove();
  }
}
