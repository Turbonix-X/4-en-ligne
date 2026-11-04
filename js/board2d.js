// ===== Le plateau en 2D : une vraie façade percée, les pions tombent derrière =====
// Board2D et Board3D ont exactement les mêmes méthodes : le reste du site ne voit pas la différence.

class Board2D {
  constructor(host, cb) {
    this.host = host;
    this.cb = cb;
    this.gen = 0;
    this.tokens = new Map();
    this.state = null;
    this.view = { viewer: null, colors: [], skins: [] };
    this.cursor = null;
    this.hint = null;
    this.targets = null;
    this.doomed = null;
    this.win = null;
    this.locked = true;

    host.innerHTML = "";
    this.root = document.createElement("div");
    this.root.className = "b2d";
    this.root.innerHTML = `
      <div class="b2d-board">
        <div class="b2d-lane"></div>
        <div class="b2d-hint"></div>
        <div class="b2d-keys" aria-hidden="true"></div>
        <i class="tok b2d-ghost"></i>
        <div class="b2d-tokens"></div>
        <svg class="b2d-plate" aria-hidden="true"></svg>
        <div class="b2d-fog"></div>
        <i class="b2d-aim"></i>
        <svg class="b2d-win" aria-hidden="true"></svg>
      </div>`;
    host.appendChild(this.root);
    this.boardEl = this.root.querySelector(".b2d-board");
    this.tokensEl = this.root.querySelector(".b2d-tokens");
    this.plateEl = this.root.querySelector(".b2d-plate");
    this.fogEl = this.root.querySelector(".b2d-fog");
    this.ghostEl = this.root.querySelector(".b2d-ghost");
    this.laneEl = this.root.querySelector(".b2d-lane");
    this.hintEl = this.root.querySelector(".b2d-hint");
    this.keysEl = this.root.querySelector(".b2d-keys");
    this.aimEl = this.root.querySelector(".b2d-aim");
    this.winEl = this.root.querySelector(".b2d-win");

    this.onMove = (e) => {
      if (e.pointerType === "touch") return;
      const p = this.cellAt(e);
      if (this.cb.onHover) this.cb.onHover(p ? p[0] : null, p ? p[1] : null);
    };
    this.onLeave = () => { if (this.cb.onHover) this.cb.onHover(null, null); };
    this.onUp = (e) => {
      const p = this.cellAt(e);
      if (p && this.cb.onPick) this.cb.onPick(p[0], p[1]);
    };
    this.root.addEventListener("pointermove", this.onMove);
    this.root.addEventListener("pointerleave", this.onLeave);
    this.root.addEventListener("pointerup", this.onUp);

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(host);
  }

  destroy() {
    this.gen++;
    this.ro.disconnect();
    this.host.innerHTML = "";
  }

  // La case sous le pointeur. La marge d'entrée compte aussi : on peut viser au-dessus de la grille.
  cellAt(e) {
    if (!this.state || !this.cell) return null;
    const r = this.boardEl.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / this.cell);
    const y = Math.floor((e.clientY - r.top) / this.cell);
    const { w, h } = this.state;
    if (x < -1 || y < -1 || x > w || y > h) return null;
    return [Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))];
  }

  // --- Mise en page ------------------------------------------------------------

  layout() {
    if (!this.state) return;
    const { w, h, o } = this.state;
    const g = o.gravity;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    // Une marge d'une case du côté où les pions entrent
    const mx = g === "left" || g === "right" ? 1 : 0;
    const my = g === "down" || g === "up" ? 1 : g === "none" ? 0.55 : 0;
    const frame = 0.34;
    const cell = Math.floor(Math.min((W - 8) / (w + mx + frame * 2), (H - 8) / (h + my + frame * 2)));
    this.cell = Math.max(14, cell);
    this.frame = this.cell * frame;
    const c = this.cell;
    const bw = w * c, bh = h * c;
    const shiftX = g === "right" ? c / 2 : g === "left" ? -c / 2 : 0;
    const shiftY = g === "down" || g === "none" ? (my * c) / 2 : g === "up" ? -c / 2 : 0;
    Object.assign(this.boardEl.style, {
      width: bw + "px",
      height: bh + "px",
      left: Math.round((W - bw) / 2 + shiftX) + "px",
      top: Math.round((H - bh) / 2 + shiftY) + "px",
    });
    this.boardEl.style.setProperty("--cell", c + "px");
    this.drawPlate();
    this.drawKeys();
    this.tokens.forEach((t) => this.place(t));
    this.drawFog();
    this.drawCursor();
    this.drawHint();
    if (this.win) this.drawWin();
  }

  drawPlate() {
    const { w, h } = this.state;
    const c = this.cell, f = this.frame;
    const W = w * c + f * 2, H = h * c + f * 2;
    const r = c * 0.41;
    let holes = "", rims = "";
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cx = f + (x + 0.5) * c, cy = f + (y + 0.5) * c;
        holes += `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
        rims += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
      }
    }
    Object.assign(this.plateEl.style, { left: -f + "px", top: -f + "px", width: W + "px", height: H + "px" });
    this.plateEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.plateEl.innerHTML = `
      <defs>
        <linearGradient id="plateFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6d49c9"/><stop offset=".45" stop-color="#47298f"/><stop offset="1" stop-color="#2a1858"/>
        </linearGradient>
        <linearGradient id="plateRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffe45c"/><stop offset=".5" stop-color="#c4a8ff"/><stop offset="1" stop-color="#ffd60a"/>
        </linearGradient>
      </defs>
      <path d="M${c * 0.3} 1.5H${W - c * 0.3}Q${W - 1.5} 1.5 ${W - 1.5} ${c * 0.3}V${H - c * 0.3}Q${W - 1.5} ${H - 1.5} ${W - c * 0.3} ${H - 1.5}H${c * 0.3}Q1.5 ${H - 1.5} 1.5 ${H - c * 0.3}V${c * 0.3}Q1.5 1.5 ${c * 0.3} 1.5Z${holes}"
        fill="url(#plateFill)" fill-rule="evenodd" stroke="url(#plateRim)" stroke-width="3"/>
      <g fill="none" stroke="rgba(10,6,24,.55)" stroke-width="${Math.max(1.5, c * 0.045)}">${rims}</g>`;
  }

  drawKeys() {
    const { w, h, o } = this.state;
    const g = o.gravity;
    const vertical = C4.isVertical(g);
    const n = vertical ? w : h;
    const c = this.cell;
    let html = "";
    for (let l = 0; l < n && l < 10; l++) {
      const label = l === 9 ? "0" : String(l + 1);
      let px, py;
      if (vertical) { px = l * c; py = g === "up" ? h * c + this.frame + 2 : -this.frame - c * 0.5; }
      else { py = l * c; px = g === "left" ? w * c + this.frame + c * 0.02 : -this.frame - c * 0.52; }
      const size = vertical ? `width:${c}px;height:${c * 0.45}px` : `width:${c * 0.5}px;height:${c}px`;
      html += `<kbd style="left:${px}px;top:${py}px;${size}">${label}</kbd>`;
    }
    this.keysEl.innerHTML = html;
  }

  makeToken(id, owner, x, y) {
    const el = document.createElement("i");
    const skin = this.view.skins[owner] || "classic";
    el.className = `tok s-${skin}`;
    Fx.tokenStyle(el, this.view.colors[owner] || "#ffd60a");
    const t = { id, owner, x, y, el };
    this.tokens.set(id, t);
    this.tokensEl.appendChild(el);
    this.place(t);
    return t;
  }

  place(t) {
    const c = this.cell;
    const size = c * 0.86;
    Object.assign(t.el.style, {
      width: size + "px",
      height: size + "px",
      left: t.x * c + (c - size) / 2 + "px",
      top: t.y * c + (c - size) / 2 + "px",
    });
  }

  mask() {
    const s = this.state;
    if (!s.o.fog || this.view.viewer == null || s.over) return null;
    return C4.visibleMask(s, this.view.viewer);
  }

  // --- Afficher une position sans animation --------------------------------------

  sync(state, view) {
    this.gen++;
    // Une copie : pendant une animation, on doit garder la position d'avant le coup
    this.state = C4.clone(state);
    if (view) this.view = view;
    this.tokensEl.innerHTML = "";
    this.tokens.clear();
    this.layout();
    const mask = this.mask();
    const { w, h } = state;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = x + y * w;
        if (state.own[c] < 0) continue;
        if (mask && !mask[c]) continue;
        this.makeToken(state.id[c], state.own[c], x, y);
      }
    }
    this.drawFog();
    this.applyMarks();
    this.drawCursor();
    this.drawHint();
    if (!this.win) this.winEl.innerHTML = "";
  }

  drawFog() {
    const s = this.state;
    this.fogEl.innerHTML = "";
    if (this.rotating) return;
    const mask = this.mask();
    if (!mask) return;
    const c = this.cell;
    const frag = document.createDocumentFragment();
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        if (mask[x + y * s.w]) continue;
        const f = document.createElement("i");
        f.style.cssText = `left:${x * c - c * 0.06}px;top:${y * c - c * 0.06}px;width:${c * 1.12}px;height:${c * 1.12}px;animation-delay:${-((x * 7 + y * 13) % 9)}s`;
        frag.appendChild(f);
      }
    }
    this.fogEl.appendChild(frag);
  }

  applyMarks() {
    this.tokens.forEach((t) => {
      t.el.classList.toggle("doomed", !!this.doomed && this.doomed === t.id);
      t.el.classList.toggle("target", !!this.targets && this.targets.includes(t.id));
    });
  }

  setDoomed(id) { this.doomed = id; this.applyMarks(); }
  setTargets(ids) { this.targets = ids; this.applyMarks(); }
  setLocked(v) { this.locked = v; this.root.classList.toggle("locked", v); this.drawCursor(); }

  // --- Curseur et indice -----------------------------------------------------------

  setCursor(cursor) { this.cursor = cursor; this.drawCursor(); }

  drawCursor() {
    const cur = this.locked ? null : this.cursor;
    const c = this.cell;
    const ghost = this.ghostEl, lane = this.laneEl, aim = this.aimEl;
    if (!cur || !this.state) {
      ghost.classList.remove("show");
      lane.classList.remove("show");
      aim.classList.remove("show");
      return;
    }
    const { w, h, o } = this.state;
    const size = c * 0.86, off = (c - size) / 2;
    const paint = (owner) => {
      ghost.className = `tok b2d-ghost s-${this.view.skins[owner] || "classic"} show`;
      Fx.tokenStyle(ghost, this.view.colors[owner] || "#ffd60a");
      ghost.style.width = ghost.style.height = size + "px";
    };
    if (cur.kind === "lane") {
      const g = o.gravity;
      const vertical = C4.isVertical(g);
      paint(cur.owner);
      let gx, gy;
      if (vertical) { gx = cur.lane; gy = g === "up" ? h : -1; } else { gy = cur.lane; gx = g === "left" ? w : -1; }
      ghost.style.left = gx * c + off + "px";
      ghost.style.top = gy * c + off + "px";
      Object.assign(lane.style, vertical
        ? { left: cur.lane * c + "px", top: 0, width: c + "px", height: h * c + "px" }
        : { left: 0, top: cur.lane * c + "px", width: w * c + "px", height: c + "px" });
      lane.classList.add("show");
      aim.classList.remove("show");
    } else if (cur.kind === "cell") {
      if (cur.bomb) {
        ghost.classList.remove("show");
      } else {
        paint(cur.owner);
        ghost.style.left = cur.x * c + off + "px";
        ghost.style.top = cur.y * c + off + "px";
      }
      lane.classList.remove("show");
      Object.assign(aim.style, { left: cur.x * c + "px", top: cur.y * c + "px", width: c + "px", height: c + "px" });
      aim.classList.toggle("bomb", !!cur.bomb);
      aim.classList.add("show");
    }
  }

  setHint(hint) { this.hint = hint; this.drawHint(); }

  drawHint() {
    const el = this.hintEl;
    const hint = this.hint;
    if (!hint || !this.state) { el.classList.remove("show"); return; }
    const c = this.cell;
    const { w, h, o } = this.state;
    if (hint.cell) {
      Object.assign(el.style, { left: hint.cell[0] * c + "px", top: hint.cell[1] * c + "px", width: c + "px", height: c + "px" });
    } else if (C4.isVertical(o.gravity)) {
      Object.assign(el.style, { left: hint.lane * c + "px", top: 0, width: c + "px", height: h * c + "px" });
    } else {
      Object.assign(el.style, { left: 0, top: hint.lane * c + "px", width: w * c + "px", height: c + "px" });
    }
    el.classList.add("show");
  }

  // --- Animations --------------------------------------------------------------------

  pointOf(x, y) {
    const b = this.boardEl.getBoundingClientRect();
    const z = this.host.getBoundingClientRect();
    return [b.left - z.left + (x + 0.5) * this.cell, b.top - z.top + (y + 0.5) * this.cell];
  }

  // Un pion qui tombe de (dx, dy) cases jusqu'à sa place, avec un rebond à l'arrivée
  fallAnim(t, dx, dy, duration, withSound = true) {
    const c = this.cell;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const at = (d) => `translate(${dx * c * d}px, ${dy * c * d}px)`;
    const back = (k) => `translate(${ux * c * k}px, ${uy * c * k}px)`;
    const anim = t.el.animate([
      { transform: at(1), easing: "cubic-bezier(.45,.02,.95,.55)" },
      { transform: "translate(0,0) scaleX(1.08) scaleY(.92)", offset: 0.62, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: `${back(0.17)}`, offset: 0.77, easing: "cubic-bezier(.5,0,.8,.5)" },
      { transform: "translate(0,0)", offset: 0.88, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: back(0.045), offset: 0.94, easing: "cubic-bezier(.5,0,.8,.5)" },
      { transform: "translate(0,0)" },
    ], { duration });
    if (withSound) {
      setTimeout(() => {
        if (typeof Sound !== "undefined") Sound.clack(0.5 + Math.min(0.5, len / 12));
        if (typeof Haptics !== "undefined") Haptics.buzz(15);
      }, duration * 0.62);
    }
    return this.finish(anim, duration);
  }

  // La fin d'une animation, avec une sécurité : si le navigateur la gèle (onglet caché), la partie continue quand même
  finish(anim, duration) {
    return Promise.race([anim.finished.catch(() => {}), Fx.wait(duration + 200)]);
  }

  fallTime(cells, speed) { return (260 + 150 * Math.sqrt(Math.max(1, cells))) / speed; }

  async play(events, state, speed = 1) {
    const my = ++this.gen;
    if (!speed) { this.sync(state); return; }
    const previous = this.state;
    const fogViewer = previous.o.fog && !state.over ? this.view.viewer : null;
    const finalMask = fogViewer != null ? C4.visibleMask(state, fogViewer) : null;
    const shown = (e) => fogViewer == null || e.owner === fogViewer || this.tokens.has(e.id);

    // Tant qu'on anime, this.state garde la taille de grille d'avant une éventuelle rotation
    for (const ev of events) {
      if (my !== this.gen) return;
      switch (ev.t) {
        case "place": {
          if (!shown(ev) && !(finalMask && finalMask[ev.x + ev.y * previous.w])) break;
          await this.animPlace(ev, speed);
          break;
        }
        case "fall": {
          const items = ev.items.filter((i) => this.tokens.has(i.id));
          if (!items.length) break;
          const longest = Math.max(...items.map((i) => Math.hypot(i.x - i.x0, i.y - i.y0)));
          const time = this.fallTime(longest, speed);
          const jobs = items.map((i) => {
            const t = this.tokens.get(i.id);
            t.x = i.x; t.y = i.y;
            this.place(t);
            return this.fallAnim(t, i.x0 - i.x, i.y0 - i.y, time, false);
          });
          setTimeout(() => { if (typeof Sound !== "undefined") Sound.clack(0.6); }, time * 0.62);
          await Promise.all(jobs);
          break;
        }
        case "remove": {
          const t = this.tokens.get(ev.id);
          if (!t) break;
          if (typeof Sound !== "undefined") Sound.erase();
          await this.finish(t.el.animate([
            { transform: "scale(1)", filter: "brightness(1)", opacity: 1 },
            { transform: "scale(1.2)", filter: "brightness(1.8)", opacity: 1, offset: 0.4 },
            { transform: "scale(0)", filter: "brightness(3)", opacity: 0 },
          ], { duration: 380 / speed, fill: "forwards" }), 380 / speed);
          t.el.remove();
          this.tokens.delete(ev.id);
          break;
        }
        case "crush": {
          if (typeof Sound !== "undefined") Sound.thud();
          const jobs = ev.items.map((i) => {
            const t = this.tokens.get(i.id);
            if (!t) return null;
            const [px, py] = this.pointOf(t.x, t.y);
            Fx.burst(this.host, 12, false, [px, py], [this.view.colors[t.owner], "#ffffff"]);
            return this.finish(t.el.animate([
              { transform: "scale(1)" },
              { transform: "scaleX(1.35) scaleY(.15)", opacity: 1, offset: 0.6 },
              { transform: "scaleX(1.5) scaleY(0)", opacity: 0 },
            ], { duration: 360 / speed, fill: "forwards" }), 360 / speed).then(() => {
              t.el.remove();
              this.tokens.delete(i.id);
            });
          });
          Fx.shake(this.boardEl, 5, 280 / speed);
          await Promise.all(jobs);
          break;
        }
        case "bomb": {
          await this.animBomb(ev, speed);
          break;
        }
        case "rotate": {
          await this.animRotate(ev, state, speed);
          break;
        }
        case "out":
        case "surrender":
          if (typeof Sound !== "undefined") Sound.lose();
          break;
      }
    }
    if (my !== this.gen) return;
    this.sync(state);
  }

  async animPlace(ev, speed) {
    const { w, h, o } = this.state;
    const t = this.makeToken(ev.id, ev.owner, ev.x, ev.y);
    if (o.gravity === "none") {
      if (typeof Sound !== "undefined") Sound.clack(0.6);
      await this.finish(t.el.animate([
        { transform: "scale(1.7)", opacity: 0, easing: "cubic-bezier(.4,0,1,1)" },
        { transform: "scale(.9)", opacity: 1, offset: 0.7 },
        { transform: "scale(1)" },
      ], { duration: 300 / speed }), 300 / speed);
      return;
    }
    let dx = 0, dy = 0;
    switch (o.gravity) {
      case "up": dy = h - ev.y; break;
      case "left": dx = w - ev.x; break;
      case "right": dx = -1 - ev.x; break;
      default: dy = -1 - ev.y;
    }
    await this.fallAnim(t, dx, dy, this.fallTime(Math.hypot(dx, dy), speed));
    if (!Fx.reduced()) {
      const [px, py] = this.pointOf(ev.x, ev.y);
      this.ripple(px, py);
    }
  }

  // Petite onde à l'atterrissage
  ripple(px, py) {
    const r = document.createElement("span");
    r.className = "land-ring";
    r.style.left = px + "px";
    r.style.top = py + "px";
    r.style.setProperty("--s", this.cell * 0.8 + "px");
    this.host.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
  }

  async animBomb(ev, speed) {
    const c = this.cell;
    const [px, py] = this.pointOf(ev.x, ev.y);
    // La bombe tombe sur la case, puis tout explose
    const bomb = document.createElement("span");
    bomb.className = "bomb-fly";
    bomb.textContent = "💣";
    bomb.style.left = px + "px";
    bomb.style.top = py + "px";
    bomb.style.fontSize = c * 0.7 + "px";
    this.host.appendChild(bomb);
    if (typeof Sound !== "undefined") Sound.whoosh(0.45 / speed);
    await this.finish(bomb.animate([
      { transform: `translate(-50%, ${-this.host.clientHeight * 0.55}px) rotate(-200deg) scale(1.6)`, opacity: 0, easing: "cubic-bezier(.5,0,.9,.6)" },
      { opacity: 1, offset: 0.2 },
      { transform: "translate(-50%, -50%) rotate(0) scale(1)" },
    ], { duration: 460 / speed }), 460 / speed);
    bomb.remove();
    if (typeof Sound !== "undefined") Sound.boom();
    if (typeof Haptics !== "undefined") Haptics.buzz([60, 30, 120]);
    const flash = document.createElement("span");
    flash.className = "blast";
    flash.style.left = px + "px";
    flash.style.top = py + "px";
    flash.style.setProperty("--s", c * 3.4 + "px");
    this.host.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());
    Fx.burst(this.host, 42, false, [px, py], ["#ffd60a", "#ff8a00", "#ff4d6d", "#ffffff", this.view.colors[ev.owner] || "#fff"]);
    Fx.shake(this.boardEl, 14, 520);
    const t = this.tokens.get(ev.id);
    if (t) { t.el.remove(); this.tokens.delete(ev.id); }
    await Fx.wait(200 / speed);
  }

  async animRotate(ev, state, speed) {
    if (typeof Sound !== "undefined") Sound.rumble(0.75 / speed);
    this.cursor = null;
    this.drawCursor();
    this.keysEl.style.opacity = 0;
    // Échelle choisie pour que la grille tienne dans la zone une fois tournée
    const newCell = this.nextCell(ev.w, ev.h);
    const scale = newCell / this.cell;
    await this.finish(this.boardEl.animate([
      { transform: "rotate(0) scale(1)" },
      { transform: `rotate(-8deg) scale(${(1 + scale) / 2 - 0.04})`, offset: 0.16 },
      { transform: `rotate(96deg) scale(${scale})`, offset: 0.82, easing: "ease-out" },
      { transform: `rotate(90deg) scale(${scale})` },
    ], { duration: 780 / speed, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" }), 780 / speed);
    // On passe à la nouvelle disposition : la position des pions tient compte du quart de tour
    this.boardEl.getAnimations().forEach((a) => a.cancel());
    const view = C4.clone(this.state);
    view.w = ev.w; view.h = ev.h;
    this.state = view;
    this.rotating = true;
    this.tokens.forEach((t) => {
      const nx = ev.h0 - 1 - t.y, ny = t.x;
      t.x = nx; t.y = ny;
    });
    this.layout();
    this.rotating = false;
    this.keysEl.style.opacity = "";
  }

  nextCell(w, h) {
    const o = this.state.o;
    const g = o.gravity;
    const mx = g === "left" || g === "right" ? 1 : 0;
    const my = g === "down" || g === "up" ? 1 : g === "none" ? 0.55 : 0;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    return Math.max(14, Math.floor(Math.min((W - 8) / (w + mx + 0.68), (H - 8) / (h + my + 0.68))));
  }

  // --- Ligne gagnante -----------------------------------------------------------------

  showWin(line, bad) {
    this.win = line ? { line, bad } : null;
    this.drawWin();
    if (!line) return;
    const s = this.state;
    line.forEach((c, k) => {
      const id = s.id[c];
      const t = this.tokens.get(id);
      if (t) {
        t.el.classList.add("won");
        t.el.style.setProperty("--d", k * 90 + "ms");
      }
    });
    this.tokens.forEach((t) => {
      if (!line.some((c) => s.id[c] === t.id)) t.el.classList.add("faded");
    });
  }

  drawWin() {
    const s = this.state;
    if (!this.win) { this.winEl.innerHTML = ""; return; }
    const c = this.cell;
    const { line, bad } = this.win;
    const W = s.w * c, H = s.h * c;
    const at = (i) => [(i % s.w + 0.5) * c, (((i / s.w) | 0) + 0.5) * c];
    const [x1, y1] = at(line[0]);
    const [x2, y2] = at(line[line.length - 1]);
    this.winEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.winEl.style.width = W + "px";
    this.winEl.style.height = H + "px";
    const color = bad ? "#ff4d6d" : "#ffd60a";
    const d = `M${x1} ${y1}L${x2} ${y2}`;
    this.winEl.innerHTML = `
      <path d="${d}" pathLength="1" class="wl glow" stroke="${color}" stroke-width="${c * 0.34}"/>
      <path d="${d}" pathLength="1" class="wl" stroke="rgba(13,12,18,.85)" stroke-width="${c * 0.2}"/>
      <path d="${d}" pathLength="1" class="wl" stroke="${color}" stroke-width="${c * 0.12}"/>`;
  }

  clearWin() { this.win = null; this.winEl.innerHTML = ""; }
}
