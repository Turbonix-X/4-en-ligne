// ===== Petits outils d'affichage communs : couleurs, particules, confettis, attentes, brouillard =====

// Le brouillard : un seul nuage sur toute la grille, dessiné sur un canvas (2D) ou une texture (3D).
// Il se dissipe en douceur autour des cases visibles, avec quelques volutes quand il s'écarte.
class FogField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.w = 0;
    this.h = 0;
    this.cell = 0;
    this.pad = 0.5;
    this.reveal = null;
    this.target = null;
    this.puffs = [];
    this.active = false;
    this.last = 0;
    this.viewer = undefined;
  }

  // Une texture de nuages qui se répète sans raccord
  static tile() {
    if (FogField._tile) return FogField._tile;
    const size = 512;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const blob = (x, y, r, color) => {
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          grad.addColorStop(0, color);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = grad;
          g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    };
    for (let k = 0; k < 70; k++) {
      const light = k % 3 !== 0;
      const color = light ? `rgba(${150 + (k % 5) * 12},${132 + (k % 5) * 10},${205 + (k % 4) * 10},.16)` : "rgba(14,9,32,.22)";
      blob(Math.random() * size, Math.random() * size, 50 + Math.random() * 110, color);
    }
    FogField._tile = c;
    return c;
  }

  static brush(size, inner, color) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.max(4, Math.ceil(size));
    const g = c.getContext("2d");
    const r = c.width / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(inner, color);
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  setup(w, h, cell) {
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.reveal = new Float32Array(w * h);
      this.target = new Float32Array(w * h);
      this.puffs = [];
    }
    if (cell !== this.cell || this.canvas.width !== Math.round((w + this.pad * 2) * cell)) {
      this.cell = cell;
      this.canvas.width = Math.round((w + this.pad * 2) * cell);
      this.canvas.height = Math.round((h + this.pad * 2) * cell);
      this.hole = FogField.brush(cell * 2.1, 0.46, "rgba(0,0,0,1)");
      this.smoke = FogField.brush(cell * 1.6, 0.05, "rgba(205,190,245,.75)");
    }
  }

  // mask : les cases visibles (null = plus de brouillard). instant : sans animation.
  setMask(mask, instant = false) {
    if (!this.reveal) return;
    const n = this.reveal.length;
    for (let c = 0; c < n; c++) {
      const t = mask ? (mask[c] ? 1 : 0) : 1;
      const was = this.target[c];
      this.target[c] = t;
      if (instant || Fx.reduced()) this.reveal[c] = t;
      else if (t === 1 && was !== 1 && mask) this.addPuffs(c);
    }
    this.active = true;
  }

  addPuffs(c) {
    if (this.puffs.length > 90) return;
    const x = c % this.w, y = (c / this.w) | 0;
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      this.puffs.push({
        x: x + 0.5, y: y + 0.5,
        vx: Math.cos(a) * (0.5 + Math.random() * 0.7),
        vy: Math.sin(a) * (0.5 + Math.random() * 0.7),
        life: 1,
        speed: 0.9 + Math.random() * 0.5,
      });
    }
  }

  // Le quart de tour du mode rotation : les zones dégagées tournent avec la grille
  rotate() {
    const { w, h } = this;
    const reveal = new Float32Array(w * h);
    const target = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = (h - 1 - y) + x * h;
        reveal[t] = this.reveal[x + y * w];
        target[t] = this.target[x + y * w];
      }
    }
    this.reveal = reveal;
    this.target = target;
    this.w = h;
    this.h = w;
    this.puffs = [];
    this.cell = 0; // Le canvas sera refait à la bonne taille
  }

  stop() {
    this.active = false;
    this.puffs = [];
    if (this.canvas.width) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Dessine une image. Renvoie faux quand il n'y a plus rien à dessiner.
  draw(now) {
    if (!this.active || !this.reveal) return false;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    let clear = true;
    for (let c = 0; c < this.reveal.length; c++) {
      const t = this.target[c];
      const v = this.reveal[c];
      if (v !== t) this.reveal[c] = t > v ? Math.min(t, v + dt * 1.5) : Math.max(t, v - dt * 0.9);
      if (this.reveal[c] < 1 || t < 1) clear = false;
    }
    const { ctx, canvas, cell, pad } = this;
    const W = canvas.width, H = canvas.height;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (clear && !this.puffs.length) { this.active = false; return false; }

    if (!clear) {
      // Le nuage lui-même : une base sombre et deux couches qui glissent à des vitesses différentes
      ctx.fillStyle = "#2d2350";
      ctx.fillRect(0, 0, W, H);
      const still = Fx.reduced();
      if (!this.pattern) this.pattern = ctx.createPattern(FogField.tile(), "repeat");
      const time = still ? 0 : now / 1000;
      for (const [sx, sy, scale, alpha] of [[9, 4, 1, 1], [-14, 7, 0.65, 0.85]]) {
        const dx = (time * sx) % 512, dy = (time * sy) % 512;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.scale(scale, scale);
        ctx.translate(dx, dy);
        ctx.fillStyle = this.pattern;
        ctx.fillRect(-dx - 2, -dy - 2, W / scale + 4, H / scale + 4);
        ctx.restore();
      }
      // Les trouées autour des cases visibles
      ctx.globalCompositeOperation = "destination-out";
      const size = this.hole.width;
      for (let c = 0; c < this.reveal.length; c++) {
        const v = this.reveal[c];
        if (v <= 0) continue;
        const px = (c % this.w + pad + 0.5) * cell, py = (((c / this.w) | 0) + pad + 0.5) * cell;
        const k = v * v * (3 - 2 * v);
        ctx.globalAlpha = k;
        const s = size * (0.55 + 0.45 * k);
        ctx.drawImage(this.hole, px - s / 2, py - s / 2, s, s);
      }
      // Un bord doux tout autour du nuage
      ctx.globalAlpha = 1;
      const edge = pad * cell * 0.75;
      const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, rw, rh);
      };
      fade(0, 0, edge, 0, 0, 0, edge, H);
      fade(W, 0, W - edge, 0, W - edge, 0, edge, H);
      fade(0, 0, 0, edge, 0, 0, W, edge);
      fade(0, H, 0, H - edge, 0, H - edge, W, edge);
      ctx.globalCompositeOperation = "source-over";
    }

    // Les volutes qui s'échappent quand le nuage s'écarte
    this.puffs = this.puffs.filter((p) => {
      p.life -= dt * p.speed;
      if (p.life <= 0) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = this.smoke.width * (1.5 - p.life * 0.8);
      ctx.globalAlpha = p.life * p.life * 0.7;
      ctx.drawImage(this.smoke, (p.x + pad) * cell - s / 2, (p.y + pad) * cell - s / 2, s, s);
      return true;
    });
    ctx.globalAlpha = 1;
    return true;
  }
}

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
