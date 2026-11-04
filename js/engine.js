// ===== Les règles du 4 en ligne : aucun affichage ici, seulement la logique =====
// Tous les modes sont des options qui se combinent. Un coup est un simple nombre :
//   0 à 999 : un couloir (une colonne, ou une ligne si la gravité va à gauche ou à droite),
//             ou une case (x + y * largeur) en mode sans gravité
//   1000 + case : une bombe sur cette case
//   2000 + joueur : ce joueur abandonne
// Comme le moteur n'utilise aucun hasard, rejouer la liste des coups redonne exactement la partie.

(function (root) {
  "use strict";

  const EMPTY = -1;
  const WALL = -2; // Pion caché par le brouillard, tel que l'ordi se le représente
  const BOMB = 1000;
  const SURRENDER = 2000;
  const CRUSH_AT = 3; // Un pion avec 3 pions sur lui est détruit
  const REPEATS = 3;

  const SIZES = [[5, 4], [6, 5], [7, 6], [8, 7], [9, 8], [10, 9]];

  function maxWin(cols, rows) { return Math.min(7, Math.max(cols, rows)); }

  // Remet les options dans des valeurs possibles, et retire les combinaisons sans aucun sens
  function normalize(input) {
    const o = Object.assign({
      cols: 7, rows: 6, win: 4, players: 2, limit: 0, gravity: "down",
      rotate: 0, bomb: false, misere: false, crush: false, fog: false, timer: 0,
    }, input);
    o.cols = clamp(o.cols | 0, 3, 12);
    o.rows = clamp(o.rows | 0, 3, 12);
    o.win = clamp(o.win | 0, 3, maxWin(o.cols, o.rows));
    o.players = clamp(o.players | 0, 2, 4);
    if (!["down", "up", "left", "right", "none"].includes(o.gravity)) o.gravity = "down";
    o.rotate = clamp(o.rotate | 0, 0, 10);
    o.limit = o.limit > 0 ? clamp(o.limit | 0, o.win, o.cols * o.rows) : 0;
    o.timer = Math.max(0, o.timer | 0);
    o.bomb = !!o.bomb; o.misere = !!o.misere; o.fog = !!o.fog; o.crush = !!o.crush;
    if (o.gravity === "none") { o.rotate = 0; o.crush = false; }
    return o;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  const endless = (o) => o.limit > 0 || o.crush;

  function create(options, starter = 0) {
    const o = normalize(options);
    const n = o.cols * o.rows;
    return {
      o,
      w: o.cols,
      h: o.rows,
      own: new Int8Array(n).fill(EMPTY),
      id: new Int32Array(n),
      turn: starter % o.players,
      alive: new Array(o.players).fill(true),
      bombs: new Array(o.players).fill(o.bomb ? 1 : 0),
      count: new Array(o.players).fill(0),
      moves: 0,
      nextId: 1,
      over: false,
      winner: -1,
      line: null,
      reason: null,
      seen: endless(o) ? new Map() : null,
    };
  }

  function clone(s, withSeen = false) {
    return {
      o: s.o, w: s.w, h: s.h,
      own: s.own.slice(), id: s.id.slice(),
      turn: s.turn,
      alive: s.alive.slice(), bombs: s.bombs.slice(), count: s.count.slice(),
      moves: s.moves, nextId: s.nextId,
      over: s.over, winner: s.winner, line: s.line, reason: s.reason,
      seen: withSeen && s.seen ? new Map(s.seen) : null,
    };
  }

  // Crée une position à partir d'un dessin : ["...", ".X.", "XOX"] (X = joueur 0, O = joueur 1)
  function fromRows(options, rows, turn = 0) {
    const s = create(Object.assign({}, options, { cols: rows[0].length, rows: rows.length }), turn);
    s.turn = turn;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const p = ch === "X" ? 0 : 1;
      const c = x + y * s.w;
      s.own[c] = p;
      s.id[c] = s.nextId++;
      s.count[p]++;
    }));
    s.moves = s.nextId - 1;
    return s;
  }

  // --- Couloirs ---------------------------------------------------------------

  const isVertical = (g) => g === "down" || g === "up" || g === "none";
  const laneCount = (s) => (isVertical(s.o.gravity) ? s.w : s.h);

  // Les cases d'un couloir, du fond (là où le pion arrive) vers l'entrée
  function laneCells(s, lane) {
    const { w, h } = s;
    const out = [];
    switch (s.o.gravity) {
      case "up": for (let y = 0; y < h; y++) out.push(lane + y * w); break;
      case "left": for (let x = 0; x < w; x++) out.push(x + lane * w); break;
      case "right": for (let x = w - 1; x >= 0; x--) out.push(x + lane * w); break;
      default: for (let y = h - 1; y >= 0; y--) out.push(lane + y * w);
    }
    return out;
  }

  // La case où un pion lâché dans ce couloir arrive (-1 si le couloir est plein)
  function landing(s, lane) {
    const { w, h, own } = s;
    switch (s.o.gravity) {
      case "up": for (let y = 0; y < h; y++) if (own[lane + y * w] === EMPTY) return lane + y * w; break;
      case "left": for (let x = 0; x < w; x++) if (own[x + lane * w] === EMPTY) return x + lane * w; break;
      case "right": for (let x = w - 1; x >= 0; x--) if (own[x + lane * w] === EMPTY) return x + lane * w; break;
      default: for (let y = h - 1; y >= 0; y--) if (own[lane + y * w] === EMPTY) return lane + y * w;
    }
    return -1;
  }

  // Tous les coups de pose possibles (sans les bombes)
  function legalMoves(s) {
    const out = [];
    if (s.over) return out;
    if (s.o.gravity === "none") {
      for (let c = 0; c < s.own.length; c++) if (s.own[c] === EMPTY) out.push(c);
    } else {
      const n = laneCount(s);
      for (let l = 0; l < n; l++) if (landing(s, l) >= 0) out.push(l);
    }
    return out;
  }

  // Les bombes possibles pour le joueur dont c'est le tour
  function bombMoves(s, mask = null) {
    const out = [];
    if (s.over || s.bombs[s.turn] <= 0) return out;
    for (let c = 0; c < s.own.length; c++) {
      if (s.own[c] >= 0 && s.own[c] !== s.turn && (!mask || mask[c])) out.push(BOMB + c);
    }
    return out;
  }

  function isFull(s) {
    for (let c = 0; c < s.own.length; c++) if (s.own[c] === EMPTY) return false;
    return true;
  }

  // --- Lignes ------------------------------------------------------------------

  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  // Cherche une ligne d'au moins « win » pions pour ce joueur. Renvoie la liste de ses cases.
  function findLine(s, p) {
    const { w, h, own } = s;
    const need = s.o.win;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (own[x + y * w] !== p) continue;
        for (let d = 0; d < 4; d++) {
          const dx = DIRS[d][0], dy = DIRS[d][1];
          const px = x - dx, py = y - dy;
          // On ne compte qu'à partir du début de la ligne
          if (px >= 0 && py >= 0 && px < w && py < h && own[px + py * w] === p) continue;
          let len = 1, cx = x + dx, cy = y + dy;
          while (cx >= 0 && cy >= 0 && cx < w && cy < h && own[cx + cy * w] === p) { len++; cx += dx; cy += dy; }
          if (len >= need) {
            const line = [];
            for (let k = 0; k < len; k++) line.push(x + k * dx + (y + k * dy) * w);
            return line;
          }
        }
      }
    }
    return null;
  }

  // Toutes les lignes possibles de « win » cases sur une grille (sert à l'ordi)
  function windows(w, h, win) {
    const out = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (const [dx, dy] of DIRS) {
          const ex = x + dx * (win - 1), ey = y + dy * (win - 1);
          if (ex < 0 || ey < 0 || ex >= w || ey >= h) continue;
          const line = [];
          for (let k = 0; k < win; k++) line.push(x + k * dx + (y + k * dy) * w);
          out.push(line);
        }
      }
    }
    return out;
  }

  // --- Mouvements du plateau ---------------------------------------------------

  // Fait tomber tous les pions dans le sens de la gravité
  function settle(s, ev) {
    if (s.o.gravity === "none") return false;
    const { w } = s;
    const n = laneCount(s);
    let items = null;
    for (let l = 0; l < n; l++) {
      const cells = laneCells(s, l);
      let free = 0;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k];
        if (s.own[c] === EMPTY) continue;
        const t = cells[free];
        if (t !== c) {
          s.own[t] = s.own[c]; s.id[t] = s.id[c];
          s.own[c] = EMPTY; s.id[c] = 0;
          if (ev) (items = items || []).push({ id: s.id[t], owner: s.own[t], x0: c % w, y0: (c / w) | 0, x: t % w, y: (t / w) | 0 });
          else items = true;
        }
        free++;
      }
    }
    if (ev && items) ev.push({ t: "fall", items });
    return !!items;
  }

  function removeAt(s, c) {
    const p = s.own[c];
    if (p >= 0) s.count[p]--;
    s.own[c] = EMPTY;
    s.id[c] = 0;
  }

  // Le pion le plus ancien d'un joueur
  function oldestOf(s, p) {
    let best = -1, bestId = Infinity;
    for (let c = 0; c < s.own.length; c++) {
      if (s.own[c] === p && s.id[c] < bestId) { bestId = s.id[c]; best = c; }
    }
    return best;
  }

  // Détruit les pions qui portent trop de poids. Renvoie vrai si quelque chose a changé.
  function crush(s, ev) {
    const n = laneCount(s);
    const items = [];
    for (let l = 0; l < n; l++) {
      const cells = laneCells(s, l);
      let height = 0;
      while (height < cells.length && s.own[cells[height]] !== EMPTY) height++;
      for (let k = 0; k < height - CRUSH_AT; k++) {
        const c = cells[k];
        items.push({ id: s.id[c], owner: s.own[c], x: c % s.w, y: (c / s.w) | 0 });
        removeAt(s, c);
      }
    }
    if (!items.length) return false;
    if (ev) ev.push({ t: "crush", items });
    settle(s, ev);
    return true;
  }

  // Tourne la grille d'un quart de tour dans le sens des aiguilles d'une montre
  function rotateGrid(s, ev) {
    const { w, h } = s;
    const own = new Int8Array(w * h).fill(EMPTY);
    const id = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = x + y * w;
        if (s.own[c] === EMPTY) continue;
        const t = (h - 1 - y) + x * h;
        own[t] = s.own[c];
        id[t] = s.id[c];
      }
    }
    s.own = own; s.id = id;
    s.w = h; s.h = w;
    if (ev) ev.push({ t: "rotate", w0: w, h0: h, w: s.w, h: s.h });
    settle(s, ev);
    if (s.o.crush) while (crush(s, ev));
  }

  // --- Fin de partie -----------------------------------------------------------

  function aliveCount(s) {
    let n = 0;
    for (let i = 0; i < s.alive.length; i++) if (s.alive[i]) n++;
    return n;
  }

  function end(s, winner, reason, line = null) {
    s.over = true;
    s.winner = winner;
    s.reason = reason;
    s.line = line;
  }

  // Regarde qui a aligné. Le joueur qui vient de jouer passe en premier.
  // Renvoie vrai si la partie est finie.
  function resolve(s, mover, ev) {
    const n = s.o.players;
    for (let k = 0; k < n; k++) {
      const p = (mover + k) % n;
      if (!s.alive[p]) continue;
      const line = findLine(s, p);
      if (!line) continue;
      if (!s.o.misere) { end(s, p, "line", line); return true; }
      // Mode inversé : celui qui aligne est éliminé. Ses pions restent sur la grille.
      if (aliveCount(s) <= 1) continue;
      s.alive[p] = false;
      if (ev) ev.push({ t: "out", p, line });
      if (aliveCount(s) === 1) { end(s, s.alive.indexOf(true), "misere", line); return true; }
    }
    return false;
  }

  function nextAlive(s, from) {
    const n = s.o.players;
    for (let k = 1; k <= n; k++) {
      const p = (from + k) % n;
      if (s.alive[p]) return p;
    }
    return from;
  }

  function moveCap(s) { return s.own.length * 4 + 40; }

  function keyOf(s) { return s.turn + ":" + s.w + ":" + s.own.join(""); }

  // --- Jouer un coup -----------------------------------------------------------

  // Modifie la position. Si « ev » est un tableau, y ajoute ce qui s'est passé, pour l'animation.
  function apply(s, m, ev = null) {
    if (s.over) return s;
    const o = s.o;
    const mover = s.turn;

    if (m >= SURRENDER) {
      const p = m - SURRENDER;
      s.alive[p] = false;
      if (ev) ev.push({ t: "surrender", p });
      if (aliveCount(s) === 1) end(s, s.alive.indexOf(true), "surrender");
      else if (s.turn === p) s.turn = nextAlive(s, p);
      return s;
    }

    if (m >= BOMB) {
      const c = m - BOMB;
      if (ev) ev.push({ t: "bomb", id: s.id[c], owner: s.own[c], by: mover, x: c % s.w, y: (c / s.w) | 0 });
      removeAt(s, c);
      s.bombs[mover]--;
      settle(s, ev);
    } else {
      const c = o.gravity === "none" ? m : landing(s, m);
      if (c < 0 || s.own[c] !== EMPTY) throw new Error("Coup impossible : " + m);
      const tid = s.nextId++;
      s.own[c] = mover;
      s.id[c] = tid;
      s.count[mover]++;
      if (ev) ev.push({ t: "place", id: tid, owner: mover, x: c % s.w, y: (c / s.w) | 0, lane: m });
      // Mode limité : on retire le plus ancien dès qu'on dépasse la limite
      if (o.limit && s.count[mover] > o.limit) {
        const old = oldestOf(s, mover);
        if (ev) ev.push({ t: "remove", id: s.id[old], owner: mover, x: old % s.w, y: (old / s.w) | 0 });
        removeAt(s, old);
        settle(s, ev);
      }
    }
    s.moves++;

    // Le pion posé compte tout de suite : une ligne verticale reste possible en mode gravité
    if (resolve(s, mover, ev)) return s;

    if (o.crush) {
      let changed = false;
      while (crush(s, ev)) changed = true;
      if (changed && resolve(s, mover, ev)) return s;
    }
    if (o.rotate && s.moves % o.rotate === 0) {
      rotateGrid(s, ev);
      if (resolve(s, mover, ev)) return s;
    }

    s.turn = nextAlive(s, mover);
    if (isFull(s)) { end(s, -1, "full"); return s; }
    if (endless(o)) {
      if (s.moves >= moveCap(s)) { end(s, -1, "cap"); return s; }
      if (s.seen) {
        const k = keyOf(s);
        const seen = (s.seen.get(k) || 0) + 1;
        s.seen.set(k, seen);
        if (seen >= REPEATS) end(s, -1, "repeat");
      }
    }
    return s;
  }

  // --- Brouillard --------------------------------------------------------------

  // Les cases que ce joueur peut voir : celles autour de ses propres pions
  function visibleMask(s, p) {
    const { w, h, own } = s;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (own[x + y * w] !== p) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) mask[nx + ny * w] = 1;
          }
        }
      }
    }
    return mask;
  }

  // Ce que ce joueur sait de la position : les pions qu'il ne voit pas ne sont que des obstacles
  function belief(s, p) {
    const view = clone(s);
    const mask = visibleMask(s, p);
    for (let c = 0; c < view.own.length; c++) {
      if (view.own[c] >= 0 && !mask[c]) {
        view.count[view.own[c]]--;
        view.own[c] = WALL;
      }
    }
    return view;
  }

  // Rejoue une liste de coups depuis le début
  function replay(options, starter, moves, upto = moves.length) {
    const s = create(options, starter);
    for (let i = 0; i < upto; i++) apply(s, moves[i]);
    return s;
  }

  const api = {
    EMPTY, WALL, BOMB, SURRENDER, CRUSH_AT, SIZES,
    normalize, maxWin, create, clone, fromRows, isVertical, laneCount, laneCells, landing,
    legalMoves, bombMoves, isFull, findLine, windows, apply, visibleMask, belief, replay,
    aliveCount, endless, settle,
  };

  root.C4 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
