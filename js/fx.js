// ===== Petits outils d'affichage communs : couleurs, particules, confettis, attentes =====

const Fx = (() => {
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur "#rrggbb"
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (v) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Noir ou blanc selon ce qui se lit le mieux sur cette couleur
  function ink(hex) {
    const n = parseInt(hex.slice(1), 16);
    const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return l > 150 ? "#15131c" : "#ffffff";
  }

  // Les variables CSS d'un pion
  function tokenStyle(el, color) {
    el.style.setProperty("--c", color);
    el.style.setProperty("--c-l", shade(color, 0.42));
    el.style.setProperty("--c-d", shade(color, -0.34));
    el.style.setProperty("--c-on", ink(color));
  }

  // Dessine un petit pion à afficher hors de la grille (barre de tour, tableau, réglages…)
  function miniToken(color, skin, cls = "") {
    const i = document.createElement("i");
    i.className = `tok mini s-${skin || "classic"} ${cls}`;
    tokenStyle(i, color);
    return i;
  }

  // Explosion de particules (big = feu d'artifice avec étoiles)
  function burst(zone, amount = 26, big = false, at = null, palette = null) {
    if (reduced() || !zone) return;
    const colors = palette || ["#ffd60a", "#9b6dff", "#ffffff", "#ffe766", "#c4a8ff"];
    for (let k = 0; k < amount; k++) {
      const p = document.createElement("span");
      p.className = big && k % 3 === 0 ? "particle star" : "particle";
      p.style.background = p.style.color = colors[k % colors.length];
      const size = (big ? 6 : 4) + Math.random() * (big ? 10 : 7);
      p.style.width = p.style.height = size + "px";
      if (at) { p.style.left = at[0] + "px"; p.style.top = at[1] + "px"; }
      else if (big) { p.style.left = 20 + Math.random() * 60 + "%"; p.style.top = 25 + Math.random() * 50 + "%"; }
      zone.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = (big ? 90 : 70) + Math.random() * (big ? 160 : 110);
      p.animate([
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
      ], { duration: 700 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => p.remove();
    }
  }

  // Secoue un élément
  function shake(el, power = 8, duration = 420) {
    if (reduced() || !el) return;
    const frames = [];
    for (let k = 0; k <= 8; k++) {
      const f = (1 - k / 8) * power;
      frames.push({ transform: k === 8 ? "none" : `translate(${(k % 2 ? 1 : -1) * f}px, ${(k % 3 - 1) * f * 0.5}px)` });
    }
    el.animate(frames, { duration, easing: "linear" });
  }

  // --- Confettis ---------------------------------------------------------------

  let canvas = null, ctx = null, pieces = [], frame = 0;

  function confettiLoop() {
    frame = 0;
    if (!canvas) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    pieces = pieces.filter((p) => p.y < h + 30 && p.life > 0);
    for (const p of pieces) {
      p.vy += 0.16;
      p.vx *= 0.992;
      p.x += p.vx + Math.sin(p.y * 0.02 + p.phase) * 0.8;
      p.y += p.vy;
      p.spin += p.vs;
      p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.scale(1, Math.cos(p.spin * 1.7));
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
      ctx.restore();
    }
    if (pieces.length) frame = requestAnimationFrame(confettiLoop);
    else ctx.clearRect(0, 0, w, h);
  }

  function confetti(amount = 140, colors = null) {
    if (reduced()) return;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "confetti";
      ctx = canvas.getContext("2d");
    }
    // En plein écran, seul l'élément affiché est visible : le canvas doit y entrer
    (document.fullscreenElement || document.body).appendChild(canvas);
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const palette = colors || ["#ffd60a", "#ffe45c", "#9b6dff", "#c9b0ff", "#ffffff"];
    for (let k = 0; k < amount; k++) {
      const fromLeft = k % 2 === 0;
      pieces.push({
        x: fromLeft ? -10 : innerWidth + 10,
        y: innerHeight * (0.35 + Math.random() * 0.3),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 11),
        vy: -7 - Math.random() * 10,
        s: 6 + Math.random() * 7,
        c: palette[k % palette.length],
        spin: Math.random() * 6,
        vs: 0.08 + Math.random() * 0.2,
        phase: Math.random() * 6,
        life: 240 + Math.random() * 90,
      });
    }
    if (!frame) frame = requestAnimationFrame(confettiLoop);
  }

  return { reduced, wait, shade, ink, tokenStyle, miniToken, burst, shake, confetti };
})();
