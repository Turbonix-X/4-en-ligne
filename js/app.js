// ===== Le déroulement du site : réglages, parties, tournoi, puzzles, analyse, statistiques =====

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LEVELS = C4AI.LEVELS;

const SWATCHES = ["#ffd60a", "#9b6dff", "#ff4d6d", "#2ee6a6", "#38bdf8", "#ffffff", "#141414"];
const NOMS_FR = {
  rouge: "#e53935", bleu: "#1e88e5", vert: "#43a047", jaune: "#ffd60a", noir: "#141414", blanc: "#ffffff",
  gris: "#808080", orange: "#fb8c00", violet: "#8e24aa", mauve: "#9b6dff", rose: "#ff6fa5", marron: "#6d4c41",
  turquoise: "#1de9b6", or: "#d4af37", argent: "#c0c0c0", cyan: "#00bcd4", bordeaux: "#7b1e3a", beige: "#e8d9b5",
};
const SKINS = [
  { key: "classic", name: "Classique" },
  { key: "x", name: "Avec un X" },
  { key: "shine", name: "Brillant" },
  { key: "gold", name: "En or" },
];

const DEFAULTS = {
  v: 1,
  play: "bot", view: "2d", speed: 1,
  cols: 7, rows: 6, win: 4,
  limitOn: false, limit: 12,
  timerOn: false, timer: 15,
  gravOn: false, gravDir: "up",
  rotateOn: false, rotate: 3,
  multi: false, multiN: 3,
  bomb: false, misere: false, crush: false, fog: false, noGrav: false,
  starter: "p0", undo: false, hint: false,
  tCount: 8, tSim: true, tEntries: [],
  slots: [
    { name: "Joueur 1", color: "#ffd60a", skin: "classic", level: 8 },
    { name: "Joueur 2", color: "#9b6dff", skin: "classic", level: 5 },
    { name: "Joueur 3", color: "#ff4d6d", skin: "classic", level: 4 },
    { name: "Joueur 4", color: "#2ee6a6", skin: "classic", level: 3 },
  ],
};

const MODES = [
  { key: "limitOn", icon: "♻️", name: "Limité", text: "Tu as un nombre limité de pions. Au-delà, ton plus ancien est retiré et tout ce qu’il y a au-dessus tombe." },
  { key: "timerOn", icon: "⚡", name: "Éclair", text: "Un temps limité par coup. Temps écoulé : un coup est joué au hasard à ta place." },
  { key: "gravOn", icon: "🧲", name: "Gravité inversée", text: "Les pions tombent vers le haut, vers la gauche ou vers la droite." },
  { key: "rotateOn", icon: "🔄", name: "Rotation", text: "Tous les quelques coups, la grille tourne d’un quart de tour et les pions retombent." },
  { key: "multi", icon: "🎉", name: "3 ou 4 joueurs", text: "Plus on est de fous… Celui qui aligne le premier gagne." },
  { key: "bomb", icon: "💣", name: "Bombe", text: "Une bombe par partie : elle fait exploser un pion adverse, à la place de ton coup." },
  { key: "misere", icon: "🙃", name: "Inversé", text: "Tout est à l’envers : si tu alignes tes pions, tu perds." },
  { key: "crush", icon: "🪨", name: "Gravité", text: "Si 3 pions adverses s’empilent juste sur un de tes pions, ils l’écrasent et le détruisent." },
  { key: "fog", icon: "🌫️", name: "Brouillard", text: "Un nuage couvre toute la grille. Il se dissipe autour de chaque pion que tu poses." },
  { key: "noGrav", icon: "🪐", name: "Sans gravité", text: "Plus rien ne tombe : pose ton pion sur la case que tu veux." },
];

const PLAY_TEXT = {
  bot: "Affronte l’ordi, du niveau 1 (Bébé) au niveau 10 (Turbonix).",
  friends: "Jouez à tour de rôle sur le même écran.",
  watch: "Installe-toi et regarde deux ordis de niveaux différents s’affronter.",
  tournament: "Jusqu’à 16 participants, humains ou ordis, en élimination directe.",
  training: "Des positions tirées de vraies parties, avec une seule bonne solution.",
};

let settings = JSON.parse(JSON.stringify(DEFAULTS));
let prefs = { sound: true, vib: true, recent: [] };
let puzzleProgress = {};
let G = null;
let board = null;
let T = null;
let tStage = "setup"; // setup | ready | playing | sim | done
let session = { last: null, lastStarter: null, score: [0, 0, 0, 0], key: "" };
let statName = null;

// --- Sauvegarde ------------------------------------------------------------------

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* stockage indisponible */ } },
};

let saveTimer;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set("c4-settings", settings), 300);
}
function savePrefs() { store.set("c4-prefs", prefs); }

function mergeSettings(raw) {
  if (!raw || typeof raw !== "object") return;
  const slots = settings.slots;
  Object.assign(settings, raw);
  if (Array.isArray(raw.slots)) {
    settings.slots = slots.map((s, i) => Object.assign({}, s, raw.slots[i] || {}));
  } else settings.slots = slots;
}

function saveGame() {
  if (!G || G.idle || G.puzzle) return;
  if (G.state.over) { store.del("c4-game"); return; }
  store.set("c4-game", {
    kind: G.kind, opts: G.opts, slots: G.slots, starter: G.starter, moves: G.moves,
    undo: G.undo, hint: G.hint, match: G.match,
  });
}

function saveTournament() {
  if (T) store.set("c4-tournament", { t: T, stage: tStage === "playing" || tStage === "sim" ? "ready" : tStage });
  else store.del("c4-tournament");
}

// --- Petits outils ------------------------------------------------------------------

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function setStatus(html, reveal = true) {
  const el = $("status");
  el.innerHTML = html;
  if (reveal) {
    el.classList.remove("reveal");
    void el.offsetWidth;
    el.classList.add("reveal");
  }
}

function confirmBox(title, text, okLabel) {
  return new Promise((resolve) => {
    const d = $("confirmDialog");
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmOk").textContent = okLabel;
    d.returnValue = "";
    d.showModal();
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
  });
}

const probe = document.createElement("canvas").getContext("2d");
function parseColor(text) {
  let s = text.trim().toLowerCase();
  if (!s) return null;
  if (NOMS_FR[s]) return NOMS_FR[s];
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(s)) s = "#" + s;
  probe.fillStyle = "#010203";
  probe.fillStyle = s;
  const out = probe.fillStyle;
  if (out === "#010203" && s !== "#010203") return null;
  return out.startsWith("#") ? out : null;
}

const fmtDate = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) +
  " à " + new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// --- De réglages à partie -----------------------------------------------------------

function playerCount() {
  if (settings.play === "tournament" || settings.play === "training") return 2;
  return settings.multi ? settings.multiN : 2;
}

function currentOpts() {
  return C4.normalize({
    cols: settings.cols, rows: settings.rows, win: settings.win,
    players: playerCount(),
    limit: settings.limitOn ? settings.limit : 0,
    timer: settings.timerOn ? settings.timer : 0,
    gravity: settings.noGrav ? "none" : settings.gravOn ? settings.gravDir : "down",
    rotate: settings.rotateOn ? settings.rotate : 0,
    bomb: settings.bomb, misere: settings.misere, crush: settings.crush, fog: settings.fog,
  });
}

function safeSkin(slot, human, name) {
  if (slot.skin !== "gold") return slot.skin;
  return human && Stats.hasGold(name) ? "gold" : "classic";
}

function currentSlots() {
  const n = playerCount();
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = settings.slots[i];
    const human = settings.play === "friends" || (settings.play === "bot" && i === 0);
    const name = human ? (s.name.trim() || `Joueur ${i + 1}`) : `${LEVELS[s.level].name} (${s.level})`;
    out.push({ human, name, level: s.level, color: s.color, skin: safeSkin(s, human, name) });
  }
  return out;
}

function resolveStarter(n) {
  const v = settings.starter;
  const rnd = () => Math.floor(Math.random() * n);
  if (v[0] === "p") {
    const p = Number(v.slice(1));
    return p < n ? p : 0;
  }
  const last = session.last;
  switch (v) {
    case "alt": return session.lastStarter == null ? rnd() : (session.lastStarter + 1) % n;
    case "winner": return last && last.winner >= 0 ? last.winner : rnd();
    case "loser": {
      if (!last || last.winner < 0) return rnd();
      if (last.loser != null) return last.loser;
      const others = [...Array(n).keys()].filter((p) => p !== last.winner);
      return others[Math.floor(Math.random() * others.length)];
    }
    default: return rnd();
  }
}

function sessionKey(opts, slots) {
  return `${settings.play}:${opts.players}:${slots.map((s) => s.name).join("|")}`;
}

// --- Le plateau -----------------------------------------------------------------------

let threePromise = null;
function loadThree() {
  if (window.THREE) return Promise.resolve(true);
  if (!threePromise) {
    threePromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => resolve(true);
      s.onerror = () => { threePromise = null; resolve(false); };
      document.head.appendChild(s);
    });
  }
  return threePromise;
}

function makeBoard(kind) {
  if (board) board.destroy();
  const cb = { onHover, onPick };
  board = kind === "3d" && Board3D.available() ? new Board3D($("boardHost"), cb) : new Board2D($("boardHost"), cb);
  return board;
}

function viewerOf(g) {
  if (!g.state.o.fog) return null;
  if (g.kind === "watch" || g.review != null) return null;
  if (g.slots.every((s) => !s.human)) return null;
  if (g.slots.filter((s) => s.human).length === 1) return g.slots.findIndex((s) => s.human);
  return g.viewer != null ? g.viewer : g.state.turn;
}

function boardView(g) {
  return {
    viewer: viewerOf(g),
    colors: g.slots.map((s) => s.color),
    skins: g.slots.map((s) => s.skin),
  };
}

function syncBoard(state = G.state) {
  board.setCursor(null);
  board.sync(state, boardView(G));
}

async function setView(kind, announce = true) {
  if (kind === "3d") {
    $("view3dNote").textContent = "Chargement de la 3D…";
    const ok = await loadThree();
    if (!ok || !Board3D.available()) {
      kind = "2d";
      toast("La 3D n’a pas pu se charger, on reste en 2D.");
      $("view3dNote").textContent = "La 3D a besoin d’Internet et d’un navigateur compatible WebGL.";
    } else {
      $("view3dNote").textContent = "Glisse sur la grille pour faire tourner la caméra.";
    }
  } else {
    $("view3dNote").textContent = "";
  }
  settings.view = kind;
  saveSettings();
  paintView();
  // On attend la fin d'une animation en cours avant de changer de plateau
  for (let k = 0; k < 40 && G && G.busy; k++) await Fx.wait(100);
  makeBoard(kind);
  if (G) {
    syncBoard(G.review != null ? C4.replay(G.opts, G.starter, G.moves, G.review) : G.state);
    if (G.state.over && G.review == null && G.state.line) board.showWin(G.state.line, G.state.reason === "misere");
    if (G.lastHint) board.setHint(G.lastHint);
    if (!G.busy) refreshInput();
  }
  if (announce) Sound.click();
}

function paintView() {
  const sw = $("viewSwitch");
  const on = settings.view === "3d" ? 1 : 0;
  sw.dataset.active = on;
  sw.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === on));
  $("viewToggle").textContent = on ? "2D" : "3D";
  $("viewToggle").title = on ? "Passer en 2D" : "Passer en 3D";
}

// --- Démarrer une partie ----------------------------------------------------------------

function baseGame(fields) {
  return Object.assign({
    idle: false, puzzle: null, match: null, moves: [], busy: false, botReq: 0, paused: false,
    undo: false, hint: false, review: null, bombMode: false, cursor: null, viewer: null,
    clockLeft: 0, clockTotal: 0, analysis: null, lastHint: null, done: false,
  }, fields);
}

function resetStage() {
  C4AI.cancel();
  stopClock();
  hideOverlays();
  document.querySelectorAll("#arena .banner").forEach((b) => b.remove());
  $("arena").classList.remove("jackpot", "landed", "rolling");
  $("analysis").classList.add("hidden");
  $("moveInfo").textContent = "";
  $("turnBar").classList.remove("over", "draw", "thinking");
  if (!board) makeBoard(settings.view);
  board.clearWin();
  board.setHint(null);
  board.setTargets(null);
  board.setDoomed(null);
  board.setLocked(true);
}

function startGame(cfg = {}) {
  resetStage();
  const opts = cfg.opts || currentOpts();
  const slots = cfg.slots || currentSlots();
  const key = sessionKey(opts, slots);
  if (key !== session.key) session = { last: null, lastStarter: null, score: [0, 0, 0, 0], key };
  const starter = cfg.starter != null ? cfg.starter : resolveStarter(opts.players);
  session.lastStarter = starter;
  const kind = cfg.match ? "tournament" : settings.play;
  G = baseGame({
    kind, opts, slots, starter,
    state: C4.create(opts, starter),
    undo: cfg.undo != null ? cfg.undo : (kind === "friends" || settings.undo),
    hint: cfg.hint != null ? cfg.hint : settings.hint,
    match: cfg.match || null,
  });
  if (cfg.moves && cfg.moves.length) {
    G.moves = cfg.moves.slice();
    G.state = C4.replay(opts, starter, G.moves);
    // Une partie en cours retrouve les positions déjà vues
    if (G.state.over) { G.moves = []; G.state = C4.create(opts, starter); }
  }
  $("pendingNote").classList.add("hidden");
  syncBoard();
  renderTurnBar();
  saveGame();
  nextTurn();
}

// Une grille vide en attendant le lancement (tournoi)
function startIdle(message) {
  resetStage();
  const opts = currentOpts();
  const slots = [
    { human: true, name: "—", level: 5, color: settings.slots[0].color, skin: "classic" },
    { human: true, name: "—", level: 5, color: settings.slots[1].color, skin: "classic" },
  ];
  G = baseGame({ idle: true, kind: "tournament", opts, slots, starter: 0, state: C4.create(opts, 0) });
  syncBoard();
  renderTurnBar();
  setStatus(message);
  refreshButtons();
  $("hint").textContent = "";
}

// --- Barre de tour ----------------------------------------------------------------------

function renderTurnBar() {
  const bar = $("turnBar");
  const g = G;
  bar.innerHTML = "";
  bar.dataset.n = g.slots.length;
  bar.style.setProperty("--n", g.slots.length);
  const glider = document.createElement("span");
  glider.className = "turn-glider";
  bar.appendChild(glider);
  g.slots.forEach((s, i) => {
    const side = document.createElement("div");
    side.className = "turn-side";
    side.dataset.p = i;
    side.appendChild(Fx.miniToken(s.color, s.skin));
    const text = document.createElement("div");
    text.className = "turn-text";
    text.innerHTML = `<span class="turn-name"></span><span class="turn-sub"></span>`;
    text.firstChild.textContent = (s.human ? "" : "🤖 ") + s.name;
    side.appendChild(text);
    if (s.human && !g.idle && !g.puzzle) {
      const flag = document.createElement("button");
      flag.className = "turn-flag";
      flag.textContent = "🏳️";
      flag.title = `${s.name} abandonne`;
      flag.setAttribute("aria-label", `${s.name} abandonne`);
      flag.addEventListener("click", () => askSurrender(i));
      side.appendChild(flag);
    }
    bar.appendChild(side);
  });
  paintTurnBar();
}

function paintTurnBar() {
  const g = G;
  const s = g.state;
  const bar = $("turnBar");
  const shown = s.over ? s.winner : s.turn;
  bar.style.setProperty("--active", shown < 0 ? 0 : shown);
  bar.classList.toggle("over", s.over || g.idle);
  bar.classList.toggle("draw", (s.over && s.winner < 0) || g.idle);
  bar.querySelectorAll(".turn-side").forEach((el) => {
    const p = Number(el.dataset.p);
    el.classList.toggle("active", !g.idle && shown === p);
    el.classList.toggle("out", !s.alive[p]);
    const sub = el.querySelector(".turn-sub");
    const bits = [];
    if (session.score[p]) bits.push(`${session.score[p]} 🏅`);
    if (s.o.limit) bits.push(`${s.count[p]}/${s.o.limit} pions`);
    if (s.o.bomb) bits.push(s.bombs[p] > 0 ? "💣" : "💥");
    if (g.puzzle) bits.length = 0;
    sub.textContent = bits.join(" · ");
    sub.style.display = bits.length ? "" : "none";
    const flag = el.querySelector(".turn-flag");
    if (flag) flag.style.display = s.over || !s.alive[p] ? "none" : "";
  });
  $("arena").style.setProperty("--turn-glow", s.over || g.idle ? "transparent" : g.slots[s.turn].color + "55");
}

// --- Le déroulement d'un tour ------------------------------------------------------------

function nextTurn() {
  const g = G;
  if (!g || g.idle) return;
  g.lastHint = null;
  board.setHint(null);
  paintTurnBar();
  refreshButtons();
  if (g.state.over) { finish(); return; }
  const p = g.state.turn;
  if (g.slots[p].human) {
    const humans = g.slots.filter((s) => s.human).length;
    if (g.state.o.fog && humans > 1 && g.viewer !== p) {
      showPass(p);
      return;
    }
    humanTurn();
  } else {
    botTurn();
  }
}

function showPass(p) {
  const g = G;
  board.setLocked(true);
  setStatus(`Passe l’écran à <strong>${esc(g.slots[p].name)}</strong>`, false);
  $("passText").textContent = `Au tour de ${g.slots[p].name}. Les autres, regardez ailleurs !`;
  $("passOverlay").classList.remove("hidden");
  $("passBtn").onclick = () => {
    $("passOverlay").classList.add("hidden");
    if (G !== g) return;
    g.viewer = p;
    syncBoard();
    humanTurn();
  };
}

function humanTurn() {
  const g = G;
  const p = g.state.turn;
  const name = g.slots[p].name;
  if (!g.puzzle) setStatus(`C’est à <strong>${esc(name)}</strong> de jouer`, false);
  if (g.state.o.limit && g.state.count[p] >= g.state.o.limit) {
    let best = 0, bestC = -1;
    g.state.own.forEach((v, c) => {
      if (v === p && (bestC < 0 || g.state.id[c] < best)) { best = g.state.id[c]; bestC = c; }
    });
    board.setDoomed(bestC >= 0 ? best : null);
  } else {
    board.setDoomed(null);
  }
  refreshInput();
  startClock();
  $("hint").innerHTML = keysHelp();
}

function keysHelp() {
  const o = G.state.o;
  const n = Math.min(10, C4.laneCount(G.state));
  const last = n === 10 ? "0" : String(n);
  const bits = [];
  if (o.gravity === "none") {
    bits.push(`<kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> et <kbd>Espace</kbd> pour poser`);
  } else {
    const word = C4.isVertical(o.gravity) ? "colonnes" : "lignes";
    const arrows = C4.isVertical(o.gravity) ? "<kbd>←</kbd><kbd>→</kbd>" : "<kbd>↑</kbd><kbd>↓</kbd>";
    bits.push(`<kbd>1</kbd> à <kbd>${last}</kbd> pour les ${word}`, `${arrows} et <kbd>Espace</kbd> pour lancer`);
  }
  if (G.undo && !G.puzzle) bits.push("<kbd>Z</kbd> annuler");
  if (G.hint || G.puzzle) bits.push("<kbd>H</kbd> indice");
  if (o.bomb) bits.push("<kbd>B</kbd> bombe");
  if (o.timer) bits.push("<kbd>P</kbd> pause");
  bits.push("<kbd>F</kbd> plein écran");
  return bits.join(" · ");
}

function canPlay() {
  const g = G;
  return !!g && !g.idle && !g.busy && !g.paused && g.review == null && !g.state.over &&
    g.slots[g.state.turn].human && $("passOverlay").classList.contains("hidden");
}

function refreshInput() {
  if (!G) return;
  board.setLocked(!canPlay());
  drawCursor();
}

async function botTurn() {
  const g = G;
  const p = g.state.turn;
  const req = ++g.botReq;
  board.setLocked(true);
  board.setDoomed(null);
  $("hint").innerHTML = g.kind === "watch" ? "<kbd>P</kbd> pause · <kbd>F</kbd> plein écran · <kbd>R</kbd> recommencer" : "";
  $("turnBar").classList.add("thinking");
  setStatus(`<strong>${esc(g.slots[p].name)}</strong> réfléchit<span class="dots"><i></i><i></i><i></i></span>`, false);
  const t0 = performance.now();
  const level = g.slots[p].level;
  let m = await C4AI.ask("move", { state: g.state, level });
  if (G !== g || req !== g.botReq) return;
  $("turnBar").classList.remove("thinking");
  if (m == null || m < 0) m = C4AI.randomMove(g.state.o.fog ? C4.belief(g.state, p) : g.state);
  const speed = settings.speed || 4;
  const least = (g.kind === "watch" ? 650 : 420) / speed;
  const left = least - (performance.now() - t0);
  if (left > 0) await Fx.wait(left);
  while (G === g && g.paused && req === g.botReq) await Fx.wait(100);
  if (G !== g || req !== g.botReq) return;
  doMove(m);
}

async function doMove(m) {
  const g = G;
  if (!g || g.busy) return;
  g.busy = true;
  stopClock();
  setBombMode(false);
  board.setLocked(true);
  board.setHint(null);
  board.setDoomed(null);
  const ev = [];
  C4.apply(g.state, m, ev);
  g.moves.push(m);
  saveGame();
  paintTurnBar();
  try {
    await board.play(ev, g.state, settings.speed);
  } finally {
    g.busy = false;
  }
  if (G !== g) return;
  announceEvents(ev);
  nextTurn();
}

function announceEvents(ev) {
  const g = G;
  for (const e of ev) {
    if (e.t === "out") toast(`🙃 ${g.slots[e.p].name} a aligné ses pions : éliminé !`);
    if (e.t === "surrender" && !g.state.over) toast(`🏳️ ${g.slots[e.p].name} abandonne.`);
  }
}

// --- Viser et jouer ------------------------------------------------------------------------

function drawCursor() {
  const g = G;
  if (!g || !canPlay() || g.cursor == null) { board.setCursor(null); return; }
  const p = g.state.turn;
  if (g.bombMode) {
    const c = g.cursor;
    board.setCursor({ kind: "cell", x: c.x, y: c.y, owner: p, bomb: true });
  } else if (g.state.o.gravity === "none") {
    const c = g.cursor;
    board.setCursor({ kind: "cell", x: c.x, y: c.y, owner: p });
  } else {
    board.setCursor({ kind: "lane", lane: g.cursor, owner: p });
  }
}

function usesCell() { return G.bombMode || G.state.o.gravity === "none"; }

function onHover(x, y) {
  const g = G;
  if (!g || !canPlay()) return;
  if (x == null) { g.cursor = null; drawCursor(); return; }
  if (usesCell()) g.cursor = { x, y };
  else g.cursor = C4.isVertical(g.state.o.gravity) ? x : y;
  drawCursor();
}

function onPick(x, y) {
  const g = G;
  if (!g || !canPlay()) return;
  if (g.bombMode) { tryBomb(x, y); return; }
  if (g.state.o.gravity === "none") { tryMove(x + y * g.state.w); return; }
  tryMove(C4.isVertical(g.state.o.gravity) ? x : y);
}

function tryMove(m) {
  const g = G;
  if (!canPlay()) return;
  const s = g.state;
  if (s.o.gravity === "none") {
    if (s.own[m] !== C4.EMPTY) { refuse(s.o.fog ? "🌫️ Cette case est déjà prise par un pion que tu ne voyais pas." : "Cette case est déjà prise."); return; }
  } else if (C4.landing(s, m) < 0) {
    refuse(C4.isVertical(s.o.gravity) ? "Cette colonne est pleine." : "Cette ligne est pleine.");
    return;
  }
  if (g.puzzle) { puzzleMove(m); return; }
  Sound.click();
  doMove(m);
}

function refuse(message) {
  toast(message);
  Sound.thud();
  Fx.shake($("boardHost"), 5, 260);
}

function tryBomb(x, y) {
  const g = G;
  const s = g.state;
  const c = x + y * s.w;
  const mask = s.o.fog ? C4.visibleMask(s, s.turn) : null;
  if (s.own[c] < 0 || s.own[c] === s.turn || (mask && !mask[c])) {
    refuse("Choisis un pion adverse que tu peux voir.");
    return;
  }
  doMove(C4.BOMB + c);
}

function setBombMode(on) {
  const g = G;
  if (!g) return;
  if (on && (!canPlay() || g.state.bombs[g.state.turn] <= 0)) return;
  if (g.bombMode === on) return;
  g.bombMode = on;
  $("bombBtn").classList.toggle("on", on);
  if (on) {
    const s = g.state;
    const mask = s.o.fog ? C4.visibleMask(s, s.turn) : null;
    const ids = [];
    s.own.forEach((v, c) => { if (v >= 0 && v !== s.turn && (!mask || mask[c])) ids.push(s.id[c]); });
    if (!ids.length) { g.bombMode = false; $("bombBtn").classList.remove("on"); toast("Aucun pion adverse à viser pour l’instant."); return; }
    board.setTargets(ids);
    g.cursor = null;
    setStatus("💣 Choisis le pion à faire exploser", false);
  } else {
    board.setTargets(null);
    g.cursor = null;
    if (canPlay() && !g.state.over) setStatus(`C’est à <strong>${esc(g.slots[g.state.turn].name)}</strong> de jouer`, false);
  }
  drawCursor();
}

function moveCursor(dx, dy) {
  const g = G;
  if (!canPlay()) return;
  const s = g.state;
  if (usesCell()) {
    const c = g.cursor && typeof g.cursor === "object" ? g.cursor : { x: (s.w / 2) | 0, y: (s.h / 2) | 0 };
    g.cursor = { x: (c.x + dx + s.w) % s.w, y: (c.y + dy + s.h) % s.h };
  } else {
    const n = C4.laneCount(s);
    const step = C4.isVertical(s.o.gravity) ? dx : dy;
    if (!step) return;
    const cur = typeof g.cursor === "number" ? g.cursor : ((n - 1) / 2) | 0;
    g.cursor = typeof g.cursor === "number" ? (cur + step + n) % n : cur;
  }
  drawCursor();
}

function confirmCursor() {
  const g = G;
  if (!canPlay()) return;
  const s = g.state;
  if (g.cursor == null) { moveCursor(0, 0); if (typeof g.cursor !== "number") moveCursor(1, 1); return; }
  if (g.bombMode) { tryBomb(g.cursor.x, g.cursor.y); return; }
  if (s.o.gravity === "none") tryMove(g.cursor.x + g.cursor.y * s.w);
  else tryMove(g.cursor);
}

// --- Temps et pause -------------------------------------------------------------------------

let clockInterval = null;

function startClock() {
  const g = G;
  stopClock();
  const total = g.opts.timer;
  $("clock").classList.toggle("hidden", !total || !!g.puzzle);
  if (!total || g.puzzle) return;
  g.clockTotal = total * 1000;
  g.clockLeft = g.clockTotal;
  g.clockLast = performance.now();
  g.tickAt = 4;
  paintClock();
  clockInterval = setInterval(() => {
    if (G !== g || g.paused) { g.clockLast = performance.now(); return; }
    const t = performance.now();
    g.clockLeft -= t - g.clockLast;
    g.clockLast = t;
    const sec = Math.ceil(g.clockLeft / 1000);
    if (sec < g.tickAt && sec > 0) { g.tickAt = sec; Sound.tick(sec === 1); }
    paintClock();
    if (g.clockLeft <= 0) timeUp();
  }, 80);
}

function stopClock() {
  clearInterval(clockInterval);
  clockInterval = null;
}

function paintClock() {
  const g = G;
  const k = Math.max(0, g.clockLeft / g.clockTotal);
  $("clockFill").style.transform = `scaleX(${k})`;
  $("clockText").textContent = Math.max(0, g.clockLeft / 1000).toFixed(g.clockLeft < 10000 ? 1 : 0) + " s";
  $("clock").classList.toggle("low", g.clockLeft < 4000);
}

function timeUp() {
  const g = G;
  stopClock();
  setBombMode(false);
  if (!canPlay()) return;
  toast(`⏰ Temps écoulé pour ${g.slots[g.state.turn].name} : coup au hasard !`);
  const view = g.state.o.fog ? C4.belief(g.state, g.state.turn) : g.state;
  const m = C4AI.randomMove(view);
  if (m == null) return;
  doMove(m);
}

function togglePause() {
  const g = G;
  if (!g || g.idle || g.state.over || g.review != null) return;
  if (!(g.opts.timer || g.kind === "watch" || g.slots.every((s) => !s.human))) return;
  g.paused = !g.paused;
  $("pauseOverlay").classList.toggle("hidden", !g.paused);
  $("arena").classList.toggle("blurred", g.paused && !!g.opts.timer);
  $("pauseBtn").textContent = g.paused ? "▶" : "⏸";
  Sound.click();
  refreshInput();
}

function hideOverlays() {
  ["pauseOverlay", "passOverlay", "vsOverlay"].forEach((id) => $(id).classList.add("hidden"));
  $("arena").classList.remove("blurred");
  $("pauseBtn").textContent = "⏸";
  $("clock").classList.add("hidden");
}

// --- Annuler, indice, abandon ---------------------------------------------------------------

function undoMove() {
  const g = G;
  if (!g || !g.undo || g.state.over || g.puzzle || g.idle || g.busy || !g.moves.length) return;
  let k = g.moves.length;
  const humans = g.slots.filter((s) => s.human).length;
  if (!humans) return;
  C4AI.cancel();
  g.botReq++;
  while (k > 0) {
    if (g.moves[k - 1] >= C4.SURRENDER) break;
    k--;
    const prev = C4.replay(g.opts, g.starter, g.moves, k);
    if (g.slots[prev.turn].human) break;
    if (k === 0) break;
  }
  if (k === g.moves.length) { toast("Impossible d’annuler plus loin."); return; }
  g.moves.length = k;
  g.state = C4.replay(g.opts, g.starter, g.moves);
  g.viewer = null;
  $("turnBar").classList.remove("thinking");
  setBombMode(false);
  syncBoard();
  Sound.erase();
  saveGame();
  toast("↩️ Coup annulé");
  nextTurn();
}

function moveText(s, m) {
  if (m >= C4.BOMB) {
    const c = m - C4.BOMB;
    return `💣 sur ${String.fromCharCode(65 + c % s.w)}${s.h - ((c / s.w) | 0)}`;
  }
  if (s.o.gravity === "none") return `case ${String.fromCharCode(65 + m % s.w)}${s.h - ((m / s.w) | 0)}`;
  return `${C4.isVertical(s.o.gravity) ? "colonne" : "ligne"} ${m + 1}`;
}

function hintFor(s, m) {
  if (m >= C4.BOMB) { const c = m - C4.BOMB; return { cell: [c % s.w, (c / s.w) | 0] }; }
  if (s.o.gravity === "none") return { cell: [m % s.w, (m / s.w) | 0] };
  return { lane: m };
}

async function askHint() {
  const g = G;
  if (!g || !canPlay()) return;
  if (g.puzzle) { puzzleHint(); return; }
  if (!g.hint) return;
  const btn = $("hintBtn");
  btn.disabled = true;
  setStatus(`💡 Je cherche le meilleur coup<span class="dots"><i></i><i></i><i></i></span>`, false);
  const r = await C4AI.ask("hint", { state: g.state, ms: 800 });
  btn.disabled = false;
  if (G !== g || !canPlay() || !r || r.move < 0) return;
  g.lastHint = hintFor(g.state, r.move);
  board.setHint(g.lastHint);
  setStatus(`💡 Meilleur coup : <strong>${moveText(g.state, r.move)}</strong>`);
  Sound.chime();
}

async function askSurrender(p) {
  const g = G;
  if (!g || g.state.over || g.idle) return;
  const ok = await confirmBox(`${g.slots[p].name} abandonne ?`, "Est-ce que vous voulez vraiment abandonner ? La partie comptera comme une défaite.", "Oui, abandonner");
  if (!ok || G !== g || g.state.over) return;
  for (let k = 0; k < 40 && g.busy; k++) await Fx.wait(100);
  if (G !== g || g.state.over) return;
  C4AI.cancel();
  g.botReq++;
  $("turnBar").classList.remove("thinking");
  setBombMode(false);
  doMove(C4.SURRENDER + p);
}

// --- Fin de partie ---------------------------------------------------------------------------

function celebrate(title, sub, big, winnerColor) {
  const arena = $("arena");
  arena.classList.remove("landed", "jackpot");
  void arena.offsetWidth;
  arena.classList.add(big ? "jackpot" : "landed");
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.innerHTML = `<span>${esc(title)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}`;
  arena.appendChild(banner);
  banner.addEventListener("animationend", (e) => { if (e.target === banner) banner.remove(); });
  const palette = winnerColor ? [winnerColor, "#ffd60a", "#9b6dff", "#ffffff", "#ffe766"] : null;
  Fx.burst(arena, 26, false, null, palette);
  if (big) {
    Fx.confetti(170, palette);
    setTimeout(() => Fx.burst(arena, 40, true, null, palette), 250);
    setTimeout(() => Fx.burst(arena, 40, true, null, palette), 800);
    setTimeout(() => Fx.confetti(90, palette), 900);
  }
}

function endText(s, g) {
  if (s.winner < 0) {
    if (s.reason === "cap") return "La partie a duré trop longtemps : égalité";
    if (s.reason === "repeat") return "La même position est revenue 3 fois : égalité";
    return "Grille pleine : égalité";
  }
  const name = g.slots[s.winner].name;
  if (s.reason === "surrender") return `Tout le monde a abandonné : ${name} gagne`;
  if (s.reason === "misere") return `Un joueur a aligné ses pions : ${name} gagne`;
  return `${name} a aligné ${s.line ? s.line.length : s.o.win} pions`;
}

function recordStats(g) {
  const s = g.state;
  const colsOf = g.slots.map(() => []);
  const firstOf = g.slots.map(() => null);
  const walker = C4.create(g.opts, g.starter);
  for (const m of g.moves) {
    const p = walker.turn;
    if (m < C4.BOMB) {
      let col = null;
      if (walker.o.gravity === "none") col = m % walker.w;
      else if (C4.isVertical(walker.o.gravity)) col = m;
      if (col != null) {
        colsOf[p].push(col);
        if (firstOf[p] == null) firstOf[p] = col;
      }
    }
    C4.apply(walker, m);
  }
  const grid = `${g.opts.cols}×${g.opts.rows}, ${g.opts.win} en ligne`;
  const modes = modeNames(g.opts);
  const unlocked = [];
  g.slots.forEach((slot, i) => {
    if (!slot.human) return;
    const result = s.winner < 0 ? "d" : s.winner === i ? "w" : "l";
    const bot = g.slots.find((o) => !o.human);
    const got = Stats.record(slot.name, result, { firstCol: firstOf[i], cols: colsOf[i], level: bot ? bot.level : null, grid, modes });
    if (got) unlocked.push(slot.name);
  });
  return unlocked;
}

function modeNames(o) {
  const names = [];
  if (o.limit) names.push(`Limité ${o.limit}`);
  if (o.timer) names.push(`Éclair ${o.timer} s`);
  if (o.gravity === "none") names.push("Sans gravité");
  else if (o.gravity !== "down") names.push("Gravité inversée");
  if (o.rotate) names.push("Rotation");
  if (o.players > 2) names.push(`${o.players} joueurs`);
  if (o.bomb) names.push("Bombe");
  if (o.misere) names.push("Inversé");
  if (o.crush) names.push("Gravité");
  if (o.fog) names.push("Brouillard");
  return names.join(", ");
}

function finish() {
  const g = G;
  if (g.done) return;
  g.done = true;
  const s = g.state;
  stopClock();
  $("clock").classList.add("hidden");
  $("hint").textContent = "";
  board.setLocked(true);
  board.setCursor(null);
  store.del("c4-game");

  if (g.puzzle) { puzzleDone(); return; }

  // Le brouillard se lève à la fin
  syncBoard();
  if (s.line) board.showWin(s.line, s.reason === "misere");

  const humanWon = s.winner >= 0 && g.slots[s.winner].human;
  const anyHuman = g.slots.some((o) => o.human);
  const watchOnly = !anyHuman;

  if (s.winner >= 0) session.score[s.winner]++;
  session.last = { winner: s.winner, loser: s.winner >= 0 && g.slots.length === 2 ? 1 - s.winner : null };
  paintTurnBar();

  if (s.winner < 0) {
    setStatus(`<span class="result-label line">Résultat</span><strong>Égalité</strong>`);
    $("moveInfo").textContent = endText(s, g);
    Sound.thud();
    Fx.shake($("boardHost"), 7, 450);
    Haptics.buzz([30, 40, 30]);
    celebrate("ÉGALITÉ", "", false);
  } else {
    const name = g.slots[s.winner].name;
    setStatus(`<span class="result-label line">Résultat</span><strong>${esc(name)} gagne !</strong>`);
    $("moveInfo").textContent = endText(s, g);
    if (humanWon || watchOnly) {
      Sound.fanfare();
      Haptics.buzz([60, 40, 60, 40, 200]);
      celebrate("VICTOIRE !", name, true, g.slots[s.winner].skin === "gold" ? "#ffd60a" : g.slots[s.winner].color);
    } else {
      Sound.lose();
      Haptics.buzz([20, 40, 30]);
      celebrate("PERDU…", `${name} gagne`, false);
    }
  }

  const unlocked = recordStats(g);
  renderStats();
  if (unlocked.length) goldUnlocked(unlocked[0]);

  if (g.match) tournamentResult(g);
  refreshButtons();
}

function goldUnlocked(name) {
  renderPlayers();
  setTimeout(() => {
    Sound.fanfare();
    Fx.confetti(260, ["#ffd60a", "#fff6a8", "#e6a800", "#ffffff"]);
    toast(`🥇 ${name} a gagné 10 fois d’affilée : pions en or débloqués !`);
  }, 900);
}

// --- Boutons ------------------------------------------------------------------------------------

function refreshButtons() {
  const g = G;
  if (!g) return;
  const s = g.state;
  const over = s.over;
  const primary = $("newBtn");
  primary.disabled = false;
  primary.classList.remove("hidden");
  if (settings.play === "tournament") {
    if (tStage === "setup") primary.textContent = "🏆 Lancer le tournoi";
    else if (tStage === "ready") primary.textContent = "▶ Match suivant";
    else if (tStage === "done") primary.textContent = "🏆 Nouveau tournoi";
    else { primary.textContent = tStage === "sim" ? "⏩ Matchs simulés…" : "Match en cours…"; primary.disabled = true; }
  } else if (settings.play === "training") {
    primary.textContent = g.puzzleSolved ? "🧩 Puzzle suivant" : "🔁 Recommencer ce puzzle";
  } else {
    primary.textContent = over ? "🔁 Rejouer" : "Nouvelle partie";
  }

  const active = !over && !g.idle;
  $("undoBtn").classList.toggle("hidden", !(g.undo && !g.puzzle && !g.idle));
  $("undoBtn").disabled = over || !g.moves.length;
  $("hintBtn").classList.toggle("hidden", !((g.hint || g.puzzle) && !g.idle));
  $("hintBtn").disabled = over;
  const showBomb = active && s.o.bomb && g.slots.some((x) => x.human);
  $("bombBtn").classList.toggle("hidden", !showBomb);
  $("bombBtn").disabled = !g.slots[s.turn].human || s.bombs[s.turn] <= 0;
  $("analyzeBtn").classList.toggle("hidden", !(over && g.moves.length && !g.puzzle));
  const canPause = active && (s.o.timer > 0 || g.slots.every((x) => !x.human));
  $("pauseBtn").classList.toggle("hidden", !canPause);
}

function onPrimary() {
  Sound.click();
  if (settings.play === "tournament") {
    if (tStage === "setup") tournamentStart();
    else if (tStage === "ready") tournamentNext();
    else if (tStage === "done") tournamentReset();
    return;
  }
  if (settings.play === "training") {
    if (G && G.puzzleSolved) nextPuzzle();
    else startPuzzle(G && G.puzzle ? G.puzzle.id : firstUnsolved());
    return;
  }
  startGame();
}

// --- Analyse ----------------------------------------------------------------------------------------

function verdictOf(best, played, isBest, count) {
  const D = C4AI.DECIDED;
  if (count <= 1) return { c: "good", t: "Coup forcé", s: "Le seul coup possible." };
  if (isBest || played >= best) return { c: "best", t: "Meilleur coup", s: "Le meilleur coup de la position." };
  if (best > D && played <= D) return { c: "blunder", t: "Victoire ratée", s: "Il y avait une victoire forcée ici." };
  if (played < -D && best >= -D) return { c: "blunder", t: "Gaffe", s: "Ce coup perd de force." };
  const gap = best - played;
  if (Math.abs(played) > D && Math.abs(best) > D) return { c: "good", t: "Bon coup", s: "La partie était déjà décidée." };
  if (gap < 12) return { c: "best", t: "Excellent", s: "Presque le meilleur coup." };
  if (gap < 40) return { c: "good", t: "Bon coup", s: "Un coup solide." };
  if (gap < 110) return { c: "meh", t: "Imprécis", s: "Il y avait un peu mieux." };
  return { c: "bad", t: "Erreur", s: "Il y avait nettement mieux." };
}

async function runAnalysis() {
  const g = G;
  if (!g || !g.state.over) return;
  $("analysis").classList.remove("hidden");
  $("anBody").classList.add("hidden");
  $("analyzeBtn").classList.add("hidden");
  if (!g.analysis) {
    $("anProgress").classList.remove("hidden");
    const list = [];
    const moves = g.moves;
    const total = moves.length;
    const walker = C4.create(g.opts, g.starter);
    for (let i = 0; i < total; i++) {
      $("anFill").style.width = (i / total) * 100 + "%";
      $("anText").textContent = `J’analyse le coup ${i + 1} sur ${total}…`;
      const m = moves[i];
      const before = C4.clone(walker);
      if (m >= C4.SURRENDER) {
        list.push({ i, m, p: m - C4.SURRENDER, surrender: true, v: { c: "", t: "Abandon", s: "" } });
      } else {
        const r = await C4AI.ask("analyze", { state: before, ms: g.opts.players > 2 ? 150 : 240, must: m });
        if (G !== g) return;
        if (!r) return;
        const found = r.scores.find((e) => e.m === m);
        const played = found ? found.v : r.score;
        list.push({
          i, m, p: before.turn, best: r.best, vBest: r.score, vPlayed: played,
          v: verdictOf(r.score, played, r.best === m, r.scores.length),
        });
      }
      C4.apply(walker, m);
    }
    g.analysis = list;
    $("anProgress").classList.add("hidden");
  }
  showAnalysis();
}

function showAnalysis() {
  const g = G;
  const list = g.analysis;
  const moves = $("rpMoves");
  moves.innerHTML = "";
  list.forEach((e, k) => {
    const b = document.createElement("button");
    b.className = `history-item move-chip ${e.v.c}`;
    b.textContent = k + 1;
    b.title = `${g.slots[e.p].name} : ${e.v.t}`;
    b.addEventListener("click", () => reviewAt(k + 1));
    moves.appendChild(b);
  });
  const kpis = $("anKpis");
  kpis.innerHTML = "";
  g.slots.forEach((slot, p) => {
    const mine = list.filter((e) => e.p === p && !e.surrender);
    const score = mine.length ? Math.round((mine.filter((e) => e.v.c === "best" || e.v.c === "good").length / mine.length) * 100) : 0;
    const box = document.createElement("div");
    box.className = "kpi";
    box.innerHTML = `<span class="kpi-value">${score} %</span><span class="kpi-label"></span>`;
    box.lastChild.textContent = `Précision · ${slot.name}`;
    kpis.appendChild(box);
  });
  const errs = list.filter((e) => e.v.c === "blunder" || e.v.c === "bad").length;
  const box = document.createElement("div");
  box.className = "kpi";
  box.innerHTML = `<span class="kpi-value">${errs}</span><span class="kpi-label">Grosses erreurs</span>`;
  kpis.appendChild(box);

  const adv = document.querySelector(".advantage");
  adv.style.setProperty("--adv-a", g.slots[0].color);
  adv.style.setProperty("--adv-b", g.slots[1].color);
  adv.classList.toggle("hidden", g.slots.length > 2);
  $("anBody").classList.remove("hidden");
  reviewAt(list.length);
  $("analysis").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Affiche la position juste après le coup n (0 = le début)
function reviewAt(n) {
  const g = G;
  const list = g.analysis;
  if (!list) return;
  n = Math.max(0, Math.min(list.length, n));
  g.review = n;
  const atEnd = n === list.length;
  // On montre la position AVANT le coup choisi, pour voir où était le meilleur coup
  const showIdx = Math.max(0, n - 1);
  const state = C4.replay(g.opts, g.starter, g.moves, n === 0 ? 0 : showIdx);
  const entry = n === 0 ? null : list[showIdx];
  board.clearWin();
  syncBoard(n === 0 || !entry ? state : C4.replay(g.opts, g.starter, g.moves, n));
  board.setHint(null);
  const note = $("anNote");
  $("rpCount").textContent = `Coup ${n} / ${list.length}`;
  [...$("rpMoves").children].forEach((c, k) => c.classList.toggle("current", k === n - 1));
  if (entry && !entry.surrender) {
    const before = state;
    const name = g.slots[entry.p].name;
    const better = entry.best !== entry.m && entry.v.c !== "best" && entry.v.c !== "good";
    // L'indice montre où il fallait jouer, sur la position d'avant le coup
    if (better) {
      const after = C4.replay(g.opts, g.starter, g.moves, n);
      if (after.w === before.w) board.setHint(hintFor(before, entry.best));
    }
    note.innerHTML = `<strong>${esc(name)}</strong> : ${moveText(before, entry.m)}. <strong>${entry.v.t}.</strong> ${entry.v.s}` +
      (better ? ` Le mieux était : <strong>${moveText(before, entry.best)}</strong> (surligné).` : "");
    const v = entry.vPlayed;
    const k = Math.abs(v) > C4AI.DECIDED ? Math.sign(v) : Math.tanh(v / 140);
    const forP0 = entry.p === 0 ? k : -k;
    $("advFill").style.width = 50 + forP0 * 50 + "%";
  } else if (entry) {
    note.textContent = `${g.slots[entry.p].name} abandonne.`;
  } else {
    note.textContent = "Le début de la partie.";
    $("advFill").style.width = "50%";
  }
  if (atEnd && g.state.line) board.showWin(g.state.line, g.state.reason === "misere");
}

function exitAnalysis() {
  const g = G;
  g.review = null;
  $("analysis").classList.add("hidden");
  board.clearWin();
  syncBoard();
  if (g.state.line) board.showWin(g.state.line, g.state.reason === "misere");
  refreshButtons();
}

// --- Puzzles -------------------------------------------------------------------------------------------

const allPuzzles = () => PUZZLES.flatMap((g) => g.list);
const findPuzzle = (id) => allPuzzles().find((p) => p.id === id);
function firstUnsolved() {
  const p = allPuzzles().find((q) => !puzzleProgress[q.id]);
  return (p || allPuzzles()[0]).id;
}

function renderPuzzles() {
  const list = $("pzList");
  list.innerHTML = "";
  PUZZLES.forEach((group) => {
    const box = document.createElement("div");
    box.className = "pz-group";
    box.innerHTML = `<div class="pz-title">${group.icon} ${group.title}</div><div class="pz-goal">${group.goal}</div>`;
    const row = document.createElement("div");
    row.className = "pz-row";
    group.list.forEach((p, i) => {
      const b = document.createElement("button");
      const stars = puzzleProgress[p.id] || 0;
      b.className = "pz-chip" + (stars ? " done" : "") + (G && G.puzzle && G.puzzle.id === p.id ? " current" : "");
      b.innerHTML = `${i + 1}<small>${"★".repeat(stars)}</small>`;
      b.setAttribute("aria-label", `Puzzle ${i + 1}${stars ? `, ${stars} étoiles` : ""}`);
      b.addEventListener("click", () => { Sound.click(); startPuzzle(p.id); });
      row.appendChild(b);
    });
    box.appendChild(row);
    list.appendChild(box);
  });
  const total = allPuzzles().length;
  const stars = Object.values(puzzleProgress).reduce((a, b) => a + b, 0);
  $("pzScore").textContent = `★ ${stars} / ${total * 3}`;
}

function puzzleSlots() {
  const a = settings.slots[0], b = settings.slots[1];
  const name = a.name.trim() || "Toi";
  return [
    { human: true, name, level: 5, color: a.color, skin: safeSkin(a, true, name) },
    { human: false, name: "L’adversaire", level: 10, color: b.color === a.color ? "#ff4d6d" : b.color, skin: "classic" },
  ];
}

function startPuzzle(id) {
  resetStage();
  const p = findPuzzle(id);
  const state = C4.fromRows(p.opts, p.r, 0);
  store.set("c4-puzzle-last", id);
  G = baseGame({
    kind: "training", puzzle: p, opts: state.o, slots: puzzleSlots(), starter: 0, state,
    pzErrors: 0, pzHinted: false, pzLeft: p.n ? 2 * p.n - 1 : 0, puzzleSolved: false,
  });
  syncBoard();
  renderTurnBar();
  renderPuzzles();
  setStatus(puzzleGoal(p));
  $("moveInfo").textContent = p.group.goal;
  refreshButtons();
  humanTurn();
}

function puzzleGoal(p) {
  if (p.n === 0) return "<strong>Un seul coup te sauve</strong>";
  if (p.n === 1) return "<strong>Gagne en 1 coup</strong>";
  return `<strong>Gagne en ${p.n} coups</strong>, quoi que fasse l’adversaire`;
}

function puzzleWrong() {
  const g = G;
  g.pzErrors++;
  Sound.lose();
  Haptics.buzz([20, 40, 30]);
  Fx.shake($("boardHost"), 8, 380);
  setStatus(g.puzzle.n === 0 ? "❌ Ce coup perd. <strong>Essaie encore</strong>" : "❌ Ce coup ne force pas la victoire. <strong>Essaie encore</strong>");
}

async function puzzleMove(m) {
  const g = G;
  const p = g.puzzle;
  if (p.n === 0) {
    if (m !== p.s) { puzzleWrong(); return; }
    g.puzzleSolved = true;
    Sound.click();
    await doMovePuzzle(m);
    if (G === g) puzzleDone();
    return;
  }
  const good = C4AI.forcedWins(g.state, g.pzLeft).some((e) => e.m === m);
  if (!good) { puzzleWrong(); return; }
  Sound.click();
  await doMovePuzzle(m);
  if (G !== g) return;
  if (g.state.over) { g.puzzleSolved = g.state.winner === 0; puzzleDone(); return; }
  // L'adversaire défend au mieux
  g.pzLeft -= 2;
  setStatus(`Bien joué ! <strong>L’adversaire répond</strong><span class="dots"><i></i><i></i><i></i></span>`, false);
  await Fx.wait(420 / (settings.speed || 4));
  if (G !== g) return;
  const reply = C4AI.bestDefense(g.state, Math.max(1, g.pzLeft + 1));
  await doMovePuzzle(reply);
  if (G !== g) return;
  setStatus(g.pzLeft > 1 ? `Continue : <strong>encore ${(g.pzLeft + 1) / 2} coups</strong>` : "<strong>À toi de finir !</strong>");
  humanTurn();
}

async function doMovePuzzle(m) {
  const g = G;
  g.busy = true;
  board.setLocked(true);
  board.setHint(null);
  const ev = [];
  C4.apply(g.state, m, ev);
  paintTurnBar();
  try { await board.play(ev, g.state, settings.speed); } finally { g.busy = false; }
}

function puzzleHint() {
  const g = G;
  const p = g.puzzle;
  g.pzHinted = true;
  const m = p.n === 0 ? p.s : (C4AI.forcedWins(g.state, g.pzLeft)[0] || { m: p.s }).m;
  g.lastHint = hintFor(g.state, m);
  board.setHint(g.lastHint);
  setStatus(`💡 Regarde par ici : <strong>${moveText(g.state, m)}</strong>`);
}

function puzzleDone() {
  const g = G;
  g.done = true;
  stopClock();
  board.setLocked(true);
  syncBoard();
  if (g.state.line) board.showWin(g.state.line, false);
  const stars = g.pzHinted ? 1 : g.pzErrors === 0 ? 3 : g.pzErrors === 1 ? 2 : 1;
  const id = g.puzzle.id;
  puzzleProgress[id] = Math.max(puzzleProgress[id] || 0, stars);
  store.set("c4-puzzles", puzzleProgress);
  g.puzzleSolved = true;
  renderPuzzles();
  Sound.fanfare();
  Haptics.buzz([20, 40, 30]);
  celebrate("RÉSOLU !", "★".repeat(stars), true, g.slots[0].color);
  setStatus(`<span class="result-label line">Puzzle réussi</span><strong>${"★".repeat(stars)}</strong>`);
  $("moveInfo").textContent = stars === 3 ? "Du premier coup, bravo !" : "Rejoue-le sans erreur ni indice pour avoir les 3 étoiles.";
  $("hint").textContent = "";
  paintTurnBar();
  refreshButtons();
}

function nextPuzzle() {
  const list = allPuzzles();
  const at = list.findIndex((p) => G && G.puzzle && p.id === G.puzzle.id);
  startPuzzle(list[(at + 1) % list.length].id);
}

// --- Tournoi ----------------------------------------------------------------------------------------------

function ensureEntries() {
  const palette = ["#ffd60a", "#9b6dff", "#ff4d6d", "#2ee6a6", "#38bdf8", "#fb8c00", "#ffffff", "#ff6fa5", "#8e24aa", "#43a047", "#1e88e5", "#e53935", "#c0c0c0", "#1de9b6", "#d4af37", "#6d4c41"];
  while (settings.tEntries.length < 16) {
    const i = settings.tEntries.length;
    const human = i === 0;
    settings.tEntries.push({ name: human ? settings.slots[0].name : "", human, level: Math.max(1, Math.min(10, 1 + (i * 3) % 10)), color: palette[i] });
  }
}

function entryName(e, i) {
  if (e.human) return e.name.trim() || `Joueur ${i + 1}`;
  return `${LEVELS[e.level].name} ${i + 1}`;
}

function renderEntries() {
  ensureEntries();
  $("tCount").value = settings.tCount;
  $("tCount").style.setProperty("--fill", ((settings.tCount - 2) / 14) * 100 + "%");
  $("tCountLabel").textContent = settings.tCount;
  $("tSim").checked = settings.tSim;
  const box = $("tEntries");
  box.innerHTML = "";
  for (let i = 0; i < settings.tCount; i++) {
    const e = settings.tEntries[i];
    const row = document.createElement("div");
    row.className = "t-entry";
    row.innerHTML = `<span class="t-num">${i + 1}</span>
      <input class="t-color" type="color" value="${e.color}" aria-label="Couleur du participant ${i + 1}">
      <input class="t-name" type="text" maxlength="20" aria-label="Nom du participant ${i + 1}" ${e.human ? "" : "disabled"}>
      <select class="t-type" aria-label="Type du participant ${i + 1}">
        <option value="0">👤 Humain</option>
        ${LEVELS.slice(1).map((l, k) => `<option value="${k + 1}">🤖 N${k + 1}</option>`).join("")}
      </select>`;
    const name = row.querySelector(".t-name");
    name.value = e.human ? e.name : entryName(e, i);
    name.placeholder = `Joueur ${i + 1}`;
    name.addEventListener("input", () => { e.name = name.value; saveSettings(); });
    const type = row.querySelector(".t-type");
    type.value = e.human ? "0" : String(e.level);
    type.addEventListener("change", () => {
      const v = Number(type.value);
      e.human = v === 0;
      if (v) e.level = v;
      saveSettings();
      renderEntries();
    });
    row.querySelector(".t-color").addEventListener("input", (ev) => { e.color = ev.target.value; saveSettings(); });
    box.appendChild(row);
  }
}

function renderTournament() {
  const hasT = !!T;
  $("tSetup").classList.toggle("hidden", hasT);
  $("tBracketWrap").classList.toggle("hidden", !hasT);
  $("tResetBtn").classList.toggle("hidden", !hasT);
  if (hasT) Tournament.render(T, $("tBracket"));
  else renderEntries();
}

function tournamentStart() {
  ensureEntries();
  const entries = settings.tEntries.slice(0, settings.tCount).map((e, i) => {
    const name = entryName(e, i);
    const skin = e.human && Stats.hasGold(name) && settings.slots[0].skin === "gold" && settings.slots[0].name === name ? "gold" : "classic";
    return { name, human: e.human, level: e.level, color: e.color, skin };
  });
  T = Tournament.create(entries);
  tStage = "ready";
  saveTournament();
  renderTournament();
  Sound.chime();
  Fx.burst($("arena"), 26);
  toast("🏆 Le tirage est fait !");
  tournamentNext();
}

function slotFromPlayer(p) {
  return { human: p.human, name: p.name, level: p.level, color: p.color, skin: p.skin };
}

async function tournamentNext() {
  if (!T) return;
  const next = Tournament.nextMatch(T);
  if (!next) { tournamentEnd(); return; }
  const a = T.players[next.m.a], b = T.players[next.m.b];

  if (!a.human && !b.human && settings.tSim) {
    tStage = "sim";
    refreshButtons();
    startIdle(`⏩ <strong>${esc(a.name)}</strong> contre <strong>${esc(b.name)}</strong>…`);
    let winner = -1;
    for (let k = 0; k < 3 && winner < 0; k++) {
      const res = await C4AI.ask("simulate", { options: currentOpts(), starter: Math.random() < 0.5 ? 0 : 1, levels: [a.level, b.level], msCap: 30 });
      if (!T || tStage !== "sim") return;
      if (res) winner = res.winner;
    }
    if (winner < 0) winner = Math.random() < 0.5 ? 0 : 1;
    await Fx.wait(350 / (settings.speed || 4));
    if (!T || tStage !== "sim") return;
    Tournament.report(T, next.r, next.i, winner === 0 ? next.m.a : next.m.b);
    Sound.click();
    renderTournament();
    saveTournament();
    await Fx.wait(420 / (settings.speed || 4));
    if (!T || tStage !== "sim") return;
    tStage = "ready";
    tournamentNext();
    return;
  }

  tStage = "playing";
  refreshButtons();
  await vsIntro(a, b, Tournament.roundName(T, next.r));
  if (!T || tStage !== "playing") return;
  const slots = [slotFromPlayer(a), slotFromPlayer(b)];
  startGame({ opts: Object.assign({}, currentOpts(), { players: 2 }), slots, match: { r: next.r, i: next.i }, undo: settings.undo, hint: settings.hint, starter: Math.random() < 0.5 ? 0 : 1 });
}

async function vsIntro(a, b, round) {
  const ov = $("vsOverlay");
  if (!settings.speed || Fx.reduced()) return;
  resetStage();
  ov.innerHTML = `<div class="vs-round">${esc(round)}</div><div class="vs-row">
    <div class="vs-side left"><span class="vs-tok"></span><span class="vs-name">${esc(a.name)}</span></div>
    <div class="vs-mark">VS</div>
    <div class="vs-side right"><span class="vs-tok"></span><span class="vs-name">${esc(b.name)}</span></div></div>`;
  const toks = ov.querySelectorAll(".vs-tok");
  toks[0].appendChild(Fx.miniToken(a.color, a.skin));
  toks[1].appendChild(Fx.miniToken(b.color, b.skin));
  ov.classList.remove("hidden");
  Sound.whoosh(0.7);
  setTimeout(() => { Sound.clack(1); Fx.burst($("arena"), 34); }, 520);
  await Fx.wait(1900 / Math.max(1, settings.speed));
  ov.classList.add("hidden");
}

function tournamentResult(g) {
  const s = g.state;
  const m = T.rounds[g.match.r][g.match.i];
  if (s.winner < 0) {
    toast("🤝 Égalité : on rejoue ce match !");
    tStage = "ready";
    refreshButtons();
    return;
  }
  Tournament.report(T, g.match.r, g.match.i, s.winner === 0 ? m.a : m.b);
  tStage = Tournament.nextMatch(T) ? "ready" : "done";
  renderTournament();
  saveTournament();
  if (T.champion !== null) setTimeout(tournamentEnd, 1700);
}

function tournamentEnd() {
  if (!T) return;
  tStage = "done";
  saveTournament();
  renderTournament();
  refreshButtons();
  const champ = T.players[T.champion];
  if (T.celebrated) return;
  T.celebrated = true;
  if (champ.human) { Stats.addTrophy(champ.name); renderStats(); }
  saveTournament();
  startIdle(`🏆 <strong>${esc(champ.name)}</strong> remporte le tournoi !`);
  $("championName").textContent = champ.name;
  $("championText").textContent = `Champion d’un tournoi à ${T.players.length} participants !`;
  const pod = $("championPodium");
  pod.innerHTML = "";
  const medals = ["🥇", "🥈", "🥉", "🥉"];
  Tournament.podium(T).forEach((id, k) => {
    const p = T.players[id];
    const row = document.createElement("div");
    row.className = "podium-row";
    row.style.setProperty("--k", k);
    row.innerHTML = `<span>${medals[k]}</span>`;
    row.appendChild(Fx.miniToken(p.color, p.skin));
    const n = document.createElement("span");
    n.textContent = p.name;
    row.appendChild(n);
    pod.appendChild(row);
  });
  $("championDialog").showModal();
  Sound.fanfare();
  Haptics.buzz([60, 40, 60, 40, 200]);
  const colors = [champ.color, "#ffd60a", "#9b6dff", "#ffffff"];
  [0, 500, 1000, 1700, 2500, 3400].forEach((d) => setTimeout(() => Fx.confetti(140, colors), d));
  setTimeout(() => Sound.ting(1), 900);
}

function tournamentReset() {
  T = null;
  tStage = "setup";
  saveTournament();
  renderTournament();
  store.del("c4-game");
  startIdle("Choisis les participants, puis lance le tournoi !");
}

// --- Réglages : affichage ---------------------------------------------------------------------------------

function chipGroup(el, attr, value) {
  el.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset[attr] === String(value)));
}

function renderGrid() {
  const sizes = $("sizeChips");
  sizes.innerHTML = "";
  C4.SIZES.forEach(([c, r]) => {
    const b = document.createElement("button");
    b.className = "chip" + (c === settings.cols && r === settings.rows ? " active" : "");
    b.textContent = `${c}×${r}`;
    if (c === 7 && r === 6) b.textContent += " ⭐";
    b.addEventListener("click", () => {
      settings.cols = c;
      settings.rows = r;
      settings.win = Math.min(settings.win, C4.maxWin(c, r));
      Sound.click();
      renderGrid();
      changed();
    });
    sizes.appendChild(b);
  });
  const wins = $("winChips");
  wins.innerHTML = "";
  const max = C4.maxWin(settings.cols, settings.rows);
  for (let k = 3; k <= 7; k++) {
    const b = document.createElement("button");
    b.className = "chip" + (k === settings.win ? " active" : "");
    b.textContent = k + (k === 4 ? " ⭐" : "");
    b.disabled = k > max;
    if (k > max) b.title = "Trop long pour cette grille";
    b.addEventListener("click", () => {
      settings.win = k;
      if (settings.limitOn && settings.limit < k) settings.limit = k;
      Sound.click();
      renderGrid();
      renderModes();
      changed();
    });
    wins.appendChild(b);
  }
  chipGroup($("speedChips"), "speed", settings.speed);
}

function renderModes() {
  const grid = $("modeGrid");
  grid.innerHTML = "";
  const lockedPlayers = settings.play === "tournament";
  MODES.forEach((mode) => {
    const on = !!settings[mode.key];
    let disabled = false;
    let why = "";
    if (settings.noGrav && ["gravOn", "rotateOn", "crush"].includes(mode.key)) { disabled = true; why = "Impossible sans gravité."; }
    if (settings.gravOn && mode.key === "noGrav") { disabled = true; why = "Impossible avec la gravité inversée."; }
    if (settings.rotateOn && mode.key === "noGrav") { disabled = true; why = "Impossible avec la rotation."; }
    if (settings.crush && mode.key === "noGrav") { disabled = true; why = "Impossible avec le mode Gravité."; }
    if (mode.key === "multi" && lockedPlayers) { disabled = true; why = "Un match de tournoi se joue à 2."; }
    const card = document.createElement("div");
    const active = on && !disabled;
    card.className = "mode-card" + (active ? " on" : "") + (disabled ? " off" : "");
    card.innerHTML = `<div class="mode-head">
        <div class="mode-title"><span class="mode-icon">${mode.icon}</span>${mode.name}</div>
        <label class="switch"><input type="checkbox" aria-label="${mode.name}" ${active ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="switch-track"><span class="switch-thumb"></span></span></label>
      </div>
      <p class="mode-text">${disabled ? why : mode.text}</p>`;
    card.querySelector("input").addEventListener("change", (e) => {
      settings[mode.key] = e.target.checked;
      Sound.click();
      if (mode.key === "multi") { renderPlayers(); renderStarter(); }
      if (mode.key === "limitOn" && settings.limit < settings.win) settings.limit = settings.win;
      renderModes();
      changed();
    });
    if (active) {
      const extra = modeExtra(mode.key);
      if (extra) card.appendChild(extra);
    }
    grid.appendChild(card);
  });
}

function modeExtra(key) {
  const box = document.createElement("div");
  box.className = "mode-extra";
  const chips = (values, current, label, set) => {
    values.forEach((v) => {
      const b = document.createElement("button");
      b.className = "chip" + (v === current ? " active" : "");
      b.textContent = label(v);
      b.addEventListener("click", () => {
        set(v);
        Sound.click();
        renderModes();
        changed();
      });
      box.appendChild(b);
    });
  };
  const number = (value, min, max, unit, set) => {
    const input = document.createElement("input");
    input.type = "number";
    input.className = "num-input";
    input.min = min;
    input.max = max;
    input.value = value;
    input.setAttribute("aria-label", unit);
    input.addEventListener("change", () => {
      const v = Math.max(min, Math.min(max, Number(input.value) || min));
      set(v);
      renderModes();
      changed();
    });
    box.appendChild(input);
    const span = document.createElement("span");
    span.className = "small muted";
    span.textContent = unit;
    box.appendChild(span);
  };
  switch (key) {
    case "limitOn":
      number(settings.limit, settings.win, settings.cols * settings.rows, "pions par joueur", (v) => { settings.limit = v; });
      return box;
    case "timerOn":
      chips([5, 10, 15, 30, 60], settings.timer, (v) => `${v} s`, (v) => { settings.timer = v; });
      number(settings.timer, 1, 600, "secondes", (v) => { settings.timer = v; });
      return box;
    case "gravOn":
      chips(["up", "left", "right"], settings.gravDir, (v) => ({ up: "⬆️ Haut", left: "⬅️ Gauche", right: "➡️ Droite" }[v]), (v) => { settings.gravDir = v; });
      return box;
    case "rotateOn": {
      const span = document.createElement("span");
      span.className = "small muted";
      span.textContent = "Tourne tous les";
      box.appendChild(span);
      chips([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], settings.rotate, (v) => String(v), (v) => { settings.rotate = v; });
      const end = document.createElement("span");
      end.className = "small muted";
      end.textContent = "coups";
      box.appendChild(end);
      return box;
    }
    case "multi":
      chips([3, 4], settings.multiN, (v) => `${v} joueurs`, (v) => {
        settings.multiN = v;
        renderPlayers();
        renderStarter();
      });
      return box;
  }
  return null;
}

function renderStarter() {
  const box = $("starterChips");
  box.innerHTML = "";
  const n = playerCount();
  const slots = currentSlots();
  const options = [];
  if (settings.play !== "tournament") slots.forEach((s, i) => options.push([`p${i}`, s.human ? s.name : `🤖 ${s.name}`]));
  options.push(["alt", "🔁 Chacun son tour"], ["random", "🎲 Au hasard"], ["winner", "🏆 Le gagnant"], ["loser", "😢 Le perdant"]);
  if (settings.starter[0] === "p" && Number(settings.starter.slice(1)) >= n) settings.starter = "p0";
  options.forEach(([v, label]) => {
    const b = document.createElement("button");
    b.className = "chip" + (settings.starter === v ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      settings.starter = v;
      Sound.click();
      renderStarter();
      changed();
    });
    box.appendChild(b);
  });
  const note = { winner: "Le gagnant de la partie d’avant commence. S’il n’y en a pas, c’est au hasard.", loser: "Le perdant de la partie d’avant commence. S’il n’y en a pas, c’est au hasard." }[settings.starter] || "";
  $("starterNote").textContent = note;
}

function renderPlayers() {
  const box = $("players");
  box.innerHTML = "";
  const n = playerCount();
  for (let i = 0; i < n; i++) box.appendChild(playerCard(i));
  checkColors();
}

function checkColors() {
  const n = playerCount();
  const colors = settings.slots.slice(0, n).map((s) => s.color);
  const same = new Set(colors).size < colors.length;
  const warn = $("sameColor");
  warn.textContent = "Plusieurs joueurs ont la même couleur : il vaut mieux les différencier avec les pions à X ou brillants.";
  warn.classList.toggle("hidden", !same);
}

function playerCard(i) {
  const slot = settings.slots[i];
  const human = settings.play === "friends" || (settings.play === "bot" && i === 0);
  const name = human ? slot.name.trim() || `Joueur ${i + 1}` : `Ordi`;
  const card = document.createElement("div");
  card.className = "player";
  card.style.setProperty("--c", slot.color);
  const head = document.createElement("div");
  head.className = "player-head";
  const preview = Fx.miniToken(slot.color, safeSkin(slot, human, name));
  head.appendChild(preview);
  if (human) {
    const input = document.createElement("input");
    input.className = "player-name";
    input.type = "text";
    input.maxLength = 20;
    input.value = slot.name;
    input.placeholder = `Joueur ${i + 1}`;
    input.setAttribute("aria-label", `Nom du joueur ${i + 1}`);
    input.addEventListener("change", () => {
      slot.name = input.value;
      renderPlayers();
      renderStarter();
      changedLook();
    });
    head.appendChild(input);
  } else {
    const title = document.createElement("div");
    title.innerHTML = `🤖 Ordi ${n2(i)}<br><span class="small muted">Niveau ${slot.level} : ${LEVELS[slot.level].name}</span>`;
    head.appendChild(title);
  }
  card.appendChild(head);

  if (!human) {
    const sec = document.createElement("div");
    sec.className = "player-section";
    sec.innerHTML = `<div class="player-label">Niveau de l’ordi</div>`;
    const row = document.createElement("div");
    row.className = "presets level-chips";
    for (let l = 1; l <= 10; l++) {
      const b = document.createElement("button");
      b.className = "chip" + (l === slot.level ? " active" : "");
      b.textContent = l;
      b.title = `${LEVELS[l].name} : ${LEVELS[l].note}`;
      b.addEventListener("click", () => {
        slot.level = l;
        Sound.click();
        renderPlayers();
        renderStarter();
        changed();
      });
      row.appendChild(b);
    }
    sec.appendChild(row);
    const note = document.createElement("p");
    note.className = "muted small";
    note.style.marginTop = "6px";
    note.textContent = LEVELS[slot.level].note;
    sec.appendChild(note);
    card.appendChild(sec);
  }

  // Couleur
  const colorSec = document.createElement("div");
  colorSec.className = "player-section color-field";
  colorSec.innerHTML = `<div class="player-label">Couleur du pion</div>`;
  const swatches = document.createElement("div");
  swatches.className = "swatches";
  const setColor = (hex, remember) => {
    slot.color = hex;
    if (remember && !SWATCHES.includes(hex)) {
      prefs.recent = [hex, ...prefs.recent.filter((c) => c !== hex)].slice(0, 7);
      savePrefs();
    }
    renderPlayers();
    changedLook();
  };
  const swatchBtn = (hex, mini) => {
    const b = document.createElement("button");
    b.className = "swatch" + (mini ? " mini" : "") + (slot.color === hex ? " active" : "");
    b.style.setProperty("--c", hex);
    b.setAttribute("aria-label", `Couleur ${hex}`);
    b.addEventListener("click", () => { Sound.click(); setColor(hex, false); });
    return b;
  };
  SWATCHES.forEach((hex) => swatches.appendChild(swatchBtn(hex)));
  colorSec.appendChild(swatches);
  const search = document.createElement("div");
  search.className = "color-search";
  search.innerHTML = `<span class="color-preview" style="background:${slot.color}"></span>
    <input class="color-input" type="text" placeholder="#ff8800, orange, rouge…" aria-label="Chercher une couleur">
    <label class="color-pick" title="Palette de couleurs">🎨<input type="color" value="${slot.color}" aria-label="Palette de couleurs"></label>`;
  const error = document.createElement("span");
  error.className = "error hidden";
  error.textContent = "Couleur inconnue.";
  const textInput = search.querySelector(".color-input");
  textInput.addEventListener("change", () => {
    const hex = parseColor(textInput.value);
    if (hex) setColor(hex, true);
    else if (textInput.value.trim()) error.classList.remove("hidden");
  });
  search.querySelector('input[type="color"]').addEventListener("change", (e) => setColor(e.target.value, true));
  colorSec.appendChild(search);
  colorSec.appendChild(error);
  if (prefs.recent.length) {
    const rec = document.createElement("div");
    rec.className = "swatches";
    prefs.recent.forEach((hex) => rec.appendChild(swatchBtn(hex, true)));
    colorSec.appendChild(rec);
  }
  card.appendChild(colorSec);

  // Style du pion
  const skinSec = document.createElement("div");
  skinSec.className = "player-section";
  skinSec.innerHTML = `<div class="player-label">Style du pion</div>`;
  const row = document.createElement("div");
  row.className = "skin-row";
  const owned = human && Stats.hasGold(name);
  const streak = human ? Stats.streakOf(name) : 0;
  SKINS.forEach((skin) => {
    const b = document.createElement("button");
    const locked = skin.key === "gold" && !owned;
    b.className = "skin" + (safeSkin(slot, human, name) === skin.key ? " active" : "");
    b.disabled = locked;
    b.appendChild(Fx.miniToken(slot.color, skin.key));
    const label = document.createElement("span");
    label.textContent = locked ? `🔒 ${skin.name}` + (human ? ` ${streak}/${Stats.GOLD_AT}` : "") : skin.name;
    b.appendChild(label);
    if (locked) b.title = human ? "Gagne 10 parties d’affilée pour débloquer les pions en or." : "L’ordi n’y a pas droit !";
    b.addEventListener("click", () => {
      slot.skin = skin.key;
      Sound.click();
      renderPlayers();
      changedLook();
    });
    row.appendChild(b);
  });
  skinSec.appendChild(row);
  card.appendChild(skinSec);
  return card;
}

const n2 = (i) => ["A", "B", "C", "D"][i];

// La couleur, le style et les noms changent tout de suite, même en pleine partie
function changedLook() {
  saveSettings();
  if (!G || G.idle || G.match || G.puzzle) { if (G && G.puzzle && !G.busy) { G.slots = puzzleSlots(); renderTurnBar(); syncBoard(); if (G.state.line) board.showWin(G.state.line, false); refreshInput(); } return; }
  const fresh = currentSlots();
  G.slots.forEach((s, i) => {
    if (!fresh[i]) return;
    s.color = fresh[i].color;
    s.skin = fresh[i].skin;
    if (s.human && !G.moves.length) s.name = fresh[i].name;
  });
  renderTurnBar();
  if (!G.busy) {
    syncBoard(G.review != null ? C4.replay(G.opts, G.starter, G.moves, G.review) : G.state);
    if (G.state.over && G.state.line && G.review == null) board.showWin(G.state.line, G.state.reason === "misere");
    refreshInput();
  }
}

function changed() {
  saveSettings();
  renderStarter();
  const g = G;
  if (!g) return;
  if (settings.play === "tournament") {
    if (g.idle) startIdle($("status").innerHTML);
    else $("pendingNote").classList.remove("hidden");
    return;
  }
  if (settings.play === "training") return;
  if (g.state.over) {
    // On ne ferme pas une analyse en cours de lecture : le réglage servira à la partie suivante
    if (g.review == null) startGame();
    return;
  }
  if (!g.moves.length) { startGame(); return; }
  $("pendingNote").classList.remove("hidden");
}

function setPlay(kind, restart = true) {
  settings.play = kind;
  saveSettings();
  document.querySelectorAll("#playTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.play === kind));
  $("modeDesc").textContent = PLAY_TEXT[kind];
  const training = kind === "training";
  const tournament = kind === "tournament";
  $("tournamentCard").classList.toggle("hidden", !tournament);
  $("trainingCard").classList.toggle("hidden", !training);
  $("gridCard").classList.toggle("hidden", training);
  $("optionsCard").classList.toggle("hidden", training);
  $("modesCard").classList.toggle("hidden", training);
  $("playersCard").classList.toggle("hidden", tournament);
  $("pendingNote").classList.add("hidden");
  renderPlayers();
  renderStarter();
  renderModes();
  if (!restart) return;
  if (training) {
    renderPuzzles();
    startPuzzle(store.get("c4-puzzle-last") || firstUnsolved());
  } else if (tournament) {
    renderTournament();
    if (T) {
      if (tStage === "playing" || tStage === "sim") tStage = "ready";
      startIdle(tStage === "done" ? `🏆 <strong>${esc(T.players[T.champion].name)}</strong> a gagné le tournoi` : "Le tournoi t’attend : lance le match suivant !");
    } else {
      startIdle("Choisis les participants, puis lance le tournoi !");
    }
  } else {
    startGame();
  }
}

// --- Statistiques -------------------------------------------------------------------------------------------

function renderStats() {
  const names = Stats.names();
  const chips = $("statProfiles");
  chips.innerHTML = "";
  if (!names.includes(statName)) statName = names[0] || null;
  names.forEach((name) => {
    const b = document.createElement("button");
    b.className = "chip" + (name === statName ? " active" : "");
    b.textContent = name;
    b.addEventListener("click", () => { statName = name; Sound.click(); renderStats(); });
    chips.appendChild(b);
  });
  const p = statName ? Stats.get(statName) : null;
  $("statEmpty").classList.toggle("hidden", !!p);
  $("statBody").classList.toggle("hidden", !p);
  $("clearPlayerBtn").classList.toggle("hidden", !p);
  if (!p) return;
  $("stGames").textContent = p.games;
  $("stWins").textContent = p.wins;
  $("stLosses").textContent = p.losses;
  $("stDraws").textContent = p.draws;
  $("stStreak").textContent = p.streak;
  $("stBest").textContent = p.bestStreak;
  $("stTrophies").textContent = p.trophies || 0;
  $("stGold").textContent = p.gold ? "🥇" : `${Math.min(p.streak, 10)}/10`;
  colBars($("stFirst"), $("stFirstTop"), p.first);
  colBars($("stAll"), $("stAllTop"), p.cols);
  const rows = $("levelRows");
  rows.innerHTML = "";
  for (let l = 1; l <= 10; l++) {
    const s = p.levels[l] || { g: 0, w: 0, d: 0, l: 0, best: 0, lastWin: null };
    const tr = document.createElement("tr");
    const last = s.lastWin ? new Date(s.lastWin).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
    tr.innerHTML = `<td><span class="lv-num">${l}</span><span class="lv-name">${LEVELS[l].name}</span></td><td>${s.g}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.best}</td><td>${last}</td>`;
    tr.addEventListener("click", () => showHistory(l));
    rows.appendChild(tr);
  }
}

function colBars(box, top, counts) {
  box.innerHTML = "";
  const entries = Object.entries(counts).map(([c, n]) => [Number(c), n]);
  if (!entries.length) {
    box.innerHTML = `<p class="muted small">Pas encore de données.</p>`;
    top.textContent = "";
    return;
  }
  const maxCol = Math.max(6, ...entries.map((e) => e[0]));
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const peak = best[1];
  const total = entries.reduce((a, b) => a + b[1], 0);
  top.textContent = `: la ${best[0] + 1}`;
  for (let c = 0; c <= maxCol; c++) {
    const n = counts[c] || 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `<div class="bar-label"><span>Colonne ${c + 1}</span><small>${n} · ${Math.round((n / total) * 100)} %</small></div><div class="bar"><div class="bar-fill" style="width:${(n / peak) * 100}%"></div></div>`;
    box.appendChild(row);
  }
}

function showHistory(level) {
  const p = Stats.get(statName);
  if (!p) return;
  const s = p.levels[level] || { w: 0, l: 0, d: 0, best: 0, history: [] };
  $("historyTitle").textContent = `${statName} contre ${LEVELS[level].name} (niveau ${level})`;
  $("histWins").textContent = s.w;
  $("histLosses").textContent = s.l;
  $("histDraws").textContent = s.d;
  $("histBest").textContent = s.best;
  const list = $("historyList");
  list.innerHTML = "";
  (s.history || []).forEach((h) => {
    const li = document.createElement("li");
    li.className = `hist-item ${h.r}`;
    const badge = { w: "🏆 Gagnée", l: "❌ Perdue", d: "🤝 Égalité" }[h.r];
    li.innerHTML = `<span class="hist-badge">${badge}</span><span class="hist-detail">${esc(h.grid)}${h.modes ? " · " + esc(h.modes) : ""}</span><span class="hist-date muted small">${fmtDate(h.at)}</span>`;
    list.appendChild(li);
  });
  $("historyEmpty").classList.toggle("hidden", !!(s.history && s.history.length));
  $("historyDialog").showModal();
}

// --- Partage ------------------------------------------------------------------------------------------------

function shareable() {
  const copy = JSON.parse(JSON.stringify(settings));
  delete copy.tEntries;
  copy.slots.forEach((s) => { if (s.skin === "gold") s.skin = "classic"; });
  return copy;
}

async function encodeConfig(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out = bytes;
  if (window.CompressionStream) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    out = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  let bin = "";
  out.forEach((b) => { bin += String.fromCharCode(b); });
  return (window.CompressionStream ? "z" : "p") + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decodeConfig(text) {
  const kind = text[0];
  const bin = atob(text.slice(1).replace(/-/g, "+").replace(/_/g, "/"));
  let bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  if (kind === "z") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function openShare() {
  $("importError").classList.add("hidden");
  const code = await encodeConfig(shareable());
  $("shareLink").value = location.href.split("#")[0] + "#c=" + code;
  $("shareDialog").showModal();
}

function exportFile() {
  const data = { app: "4-en-ligne", v: 1, settings, stats: Stats.exportData(), puzzles: puzzleProgress };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "4-en-ligne-sauvegarde.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast("Fichier téléchargé 💾");
}

async function importFile(file) {
  const err = $("importError");
  err.classList.add("hidden");
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "4-en-ligne") throw new Error("mauvais fichier");
    if (data.settings) mergeSettings(data.settings);
    if (data.stats) Stats.importData(data.stats);
    if (data.puzzles) { puzzleProgress = data.puzzles; store.set("c4-puzzles", puzzleProgress); }
    saveSettings();
    $("shareDialog").close();
    toast("Sauvegarde chargée ✅");
    paintAll();
    setPlay(settings.play);
  } catch (e) {
    err.textContent = "Ce fichier n’est pas une sauvegarde du 4 en ligne.";
    err.classList.remove("hidden");
  }
}

function paintAll() {
  renderGrid();
  renderModes();
  renderPlayers();
  renderStarter();
  renderStats();
  renderPuzzles();
  paintView();
  $("undoOpt").checked = settings.undo;
  $("hintOpt").checked = settings.hint;
  $("tSim").checked = settings.tSim;
}

// --- Plein écran ------------------------------------------------------------------------------------------------

function toggleFullscreen() {
  const card = $("playCard");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (card.requestFullscreen) card.requestFullscreen().catch(() => toast("Le plein écran n’est pas disponible ici."));
  else toast("Le plein écran n’est pas disponible ici.");
}

document.addEventListener("fullscreenchange", () => {
  // La notification doit rester visible en plein écran
  (document.fullscreenElement || document.body).appendChild($("toast"));
});

// --- Clavier ---------------------------------------------------------------------------------------------------------

document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t.matches && t.matches("input, select, textarea")) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const g = G;
  const key = e.key;

  if (g && g.review != null && g.analysis) {
    if (key === "ArrowLeft") { e.preventDefault(); reviewAt(g.review - 1); return; }
    if (key === "ArrowRight") { e.preventDefault(); reviewAt(g.review + 1); return; }
    if (key === "Escape") { exitAnalysis(); return; }
  }

  if (/^[0-9]$/.test(key) && g && !g.idle) {
    const idx = key === "0" ? 9 : Number(key) - 1;
    if (!canPlay()) return;
    const s = g.state;
    if (usesCell()) {
      if (idx < s.w) {
        const c = g.cursor && typeof g.cursor === "object" ? g.cursor : { x: 0, y: (s.h / 2) | 0 };
        g.cursor = { x: idx, y: c.y };
        drawCursor();
      }
    } else if (idx < C4.laneCount(s)) {
      g.cursor = idx;
      tryMove(idx);
    }
    return;
  }

  switch (key) {
    case "ArrowLeft": e.preventDefault(); moveCursor(-1, 0); break;
    case "ArrowRight": e.preventDefault(); moveCursor(1, 0); break;
    case "ArrowUp": e.preventDefault(); moveCursor(0, -1); break;
    case "ArrowDown": e.preventDefault(); moveCursor(0, 1); break;
    case " ":
    case "Enter":
      if (t.tagName === "BUTTON" || t.tagName === "A" || t.tagName === "SUMMARY") return;
      e.preventDefault();
      if (!g) return;
      if (canPlay()) confirmCursor();
      else if ((g.state.over || g.idle) && !$("newBtn").disabled && !$("newBtn").classList.contains("hidden")) onPrimary();
      break;
    case "z": case "Z": undoMove(); break;
    case "h": case "H": askHint(); break;
    case "b": case "B": if (g && g.state.o.bomb) setBombMode(!g.bombMode); break;
    case "p": case "P": togglePause(); break;
    case "f": case "F": toggleFullscreen(); break;
    case "r": case "R": if (settings.play !== "tournament") onPrimary(); break;
    case "Escape": if (g && g.bombMode) setBombMode(false); break;
  }
});

// Après un clic de souris, on rend le clavier au jeu (Espace ne doit pas recliquer le bouton)
document.addEventListener("click", (e) => {
  if (e.detail > 0 && e.target.closest("button, .switch")) {
    const el = document.activeElement;
    if (el && el.blur && !el.matches("input[type=text], input[type=number], select")) el.blur();
  }
});

// --- Boutons fixes ------------------------------------------------------------------------------------------------------

function paintSoundButtons() {
  const s = $("soundBtn"), v = $("vibBtn");
  s.classList.toggle("off", !prefs.sound);
  s.setAttribute("aria-pressed", prefs.sound);
  s.title = prefs.sound ? "Sons activés" : "Sons coupés";
  v.classList.toggle("off", !prefs.vib);
  v.setAttribute("aria-pressed", prefs.vib);
  const canVibrate = "vibrate" in navigator;
  v.title = (prefs.vib ? "Vibrations activées" : "Vibrations coupées") + (canVibrate ? "" : " (sur téléphone uniquement)");
  Sound.enabled = prefs.sound;
  Haptics.enabled = prefs.vib;
}

function wire() {
  $("year").textContent = new Date().getFullYear();

  $("themeBtn").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      const p = JSON.parse(localStorage.getItem("tx-prefs")) || {};
      p.theme = theme;
      localStorage.setItem("tx-prefs", JSON.stringify(p));
    } catch (e) { /* stockage indisponible */ }
  });
  $("soundBtn").addEventListener("click", () => { prefs.sound = !prefs.sound; savePrefs(); paintSoundButtons(); Sound.click(); });
  $("vibBtn").addEventListener("click", () => { prefs.vib = !prefs.vib; savePrefs(); paintSoundButtons(); Haptics.buzz(30); });
  $("shareBtn").addEventListener("click", openShare);
  $("copyLinkBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("shareLink").value); toast("Lien copié ! 🔗"); }
    catch (e) { $("shareLink").select(); toast("Copie le lien à la main."); }
  });
  $("exportBtn").addEventListener("click", exportFile);
  $("importInput").addEventListener("change", (e) => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
  $("clearBtn").addEventListener("click", async () => {
    const ok = await confirmBox("Tout effacer ?", "Est-ce que vous voulez vraiment tout effacer ? Les statistiques de tous les joueurs, les pions en or, les puzzles réussis, le tournoi en cours et la partie en cours seront perdus. Cette action est définitive.", "Oui, tout effacer");
    if (!ok) return;
    Stats.clearAll();
    puzzleProgress = {};
    ["c4-puzzles", "c4-game", "c4-tournament", "c4-puzzle-last"].forEach(store.del);
    T = null;
    tStage = "setup";
    session = { last: null, lastStarter: null, score: [0, 0, 0, 0], key: "" };
    toast("Tout est effacé 🗑");
    paintAll();
    setPlay(settings.play);
  });
  $("clearPlayerBtn").addEventListener("click", async () => {
    if (!statName) return;
    const name = statName;
    const ok = await confirmBox(`Effacer ${name} ?`, `Est-ce que vous voulez vraiment effacer les données de ${name} ? Ses statistiques et ses pions en or seront perdus. Cette action est définitive.`, "Oui, effacer");
    if (!ok) return;
    Stats.clearPlayer(name);
    toast(`Les données de ${name} sont effacées 🗑`);
    renderStats();
    renderPlayers();
  });

  document.querySelectorAll("#playTabs .tab").forEach((t) => {
    t.addEventListener("click", () => {
      if (t.dataset.play === settings.play) return;
      Sound.click();
      setPlay(t.dataset.play);
    });
  });

  $("newBtn").addEventListener("click", onPrimary);
  $("undoBtn").addEventListener("click", undoMove);
  $("hintBtn").addEventListener("click", askHint);
  $("bombBtn").addEventListener("click", () => { if (G) setBombMode(!G.bombMode); });
  $("analyzeBtn").addEventListener("click", runAnalysis);
  $("pauseBtn").addEventListener("click", togglePause);
  $("resumeBtn").addEventListener("click", togglePause);
  $("fullBtn").addEventListener("click", toggleFullscreen);
  $("viewToggle").addEventListener("click", () => setView(settings.view === "3d" ? "2d" : "3d"));
  $("viewSwitch").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => { if (b.dataset.view !== settings.view) setView(b.dataset.view); });
  });

  $("speedChips").querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      settings.speed = Number(b.dataset.speed);
      Sound.click();
      chipGroup($("speedChips"), "speed", settings.speed);
      saveSettings();
    });
  });
  $("classicBtn").addEventListener("click", () => {
    Object.assign(settings, { cols: 7, rows: 6, win: 4, limitOn: false, timerOn: false, gravOn: false, rotateOn: false, multi: false, bomb: false, misere: false, crush: false, fog: false, noGrav: false });
    Sound.click();
    toast("🎯 Retour au 4 en ligne classique");
    renderGrid();
    renderModes();
    renderPlayers();
    changed();
  });
  $("undoOpt").addEventListener("change", (e) => { settings.undo = e.target.checked; saveSettings(); if (G && G.moves.length && !G.state.over) toast("Ce sera pour la prochaine partie."); else if (G && !G.idle && !G.puzzle && settings.play !== "friends") { G.undo = settings.undo; refreshButtons(); } });
  $("hintOpt").addEventListener("change", (e) => { settings.hint = e.target.checked; saveSettings(); if (G && G.moves.length && !G.state.over) toast("Ce sera pour la prochaine partie."); else if (G && !G.idle && !G.puzzle) { G.hint = settings.hint; refreshButtons(); } });

  $("rpFirst").addEventListener("click", () => reviewAt(0));
  $("rpPrev").addEventListener("click", () => reviewAt(G.review - 1));
  $("rpNext").addEventListener("click", () => reviewAt(G.review + 1));
  $("rpLast").addEventListener("click", () => reviewAt(G.analysis.length));
  $("rpExit").addEventListener("click", exitAnalysis);

  // Tournoi
  $("tCount").addEventListener("input", (e) => {
    settings.tCount = Number(e.target.value);
    saveSettings();
    renderEntries();
  });
  $("tSim").addEventListener("change", (e) => { settings.tSim = e.target.checked; saveSettings(); });
  $("tBots").addEventListener("click", () => {
    ensureEntries();
    settings.tEntries.slice(0, settings.tCount).forEach((e) => { e.human = false; });
    saveSettings();
    renderEntries();
  });
  $("tRandomLv").addEventListener("click", () => {
    ensureEntries();
    settings.tEntries.forEach((e) => { e.level = 1 + Math.floor(Math.random() * 10); });
    saveSettings();
    renderEntries();
  });
  $("tResetBtn").addEventListener("click", async () => {
    const ok = await confirmBox("Annuler le tournoi ?", "Est-ce que vous voulez vraiment annuler ce tournoi ? Le tableau sera perdu.", "Oui, l’annuler");
    if (ok) tournamentReset();
  });
}

// --- Démarrage -------------------------------------------------------------------------------------------------------------

async function boot() {
  mergeSettings(store.get("c4-settings"));
  const p = store.get("c4-prefs");
  if (p) Object.assign(prefs, p);
  puzzleProgress = store.get("c4-puzzles") || {};
  const savedT = store.get("c4-tournament");
  if (savedT && savedT.t) { T = savedT.t; tStage = savedT.stage || "ready"; }

  // Un lien de partage ?
  let shared = false;
  if (location.hash.startsWith("#c=")) {
    try {
      mergeSettings(await decodeConfig(location.hash.slice(3)));
      shared = true;
    } catch (e) { /* lien abîmé : on l'ignore */ }
    history.replaceState(null, "", location.pathname + location.search);
  }

  wire();
  paintSoundButtons();
  paintAll();
  renderTournament();

  if (settings.view === "3d") {
    const ok = await loadThree();
    if (!ok || !Board3D.available()) { settings.view = "2d"; paintView(); }
    else $("view3dNote").textContent = "Glisse sur la grille pour faire tourner la caméra.";
  }
  makeBoard(settings.view);

  const saved = store.get("c4-game");
  const canResume = !shared && saved && saved.moves && saved.moves.length && saved.kind === settings.play && !saved.match;
  setPlay(settings.play, !canResume);
  if (canResume) {
    try {
      startGame({ opts: saved.opts, slots: saved.slots, starter: saved.starter, moves: saved.moves, undo: saved.undo, hint: saved.hint });
      toast("Partie en cours retrouvée ♻️");
    } catch (e) {
      store.del("c4-game");
      startGame();
    }
  }
  if (shared) toast("Réglages du lien chargés 🔗");
}

boot();
