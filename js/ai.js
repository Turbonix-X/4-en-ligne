// ===== L'ordi : 10 niveaux, l'indice et l'analyse de partie =====
// Deux moteurs de recherche :
//  - FastSearch : très rapide, pour 2 joueurs avec une gravité simple (classique, inversé, gravité à gauche…)
//  - GeneralSearch : passe par les vraies règles, pour tous les autres modes (limité, rotation, bombe, 3-4 joueurs…)
// Un niveau se règle par sa profondeur de calcul, son temps et sa part d'erreurs volontaires.

(function (root) {
  "use strict";

  const C4 = root.C4;
  const WIN = 1000000;
  const DECIDED = WIN - 2000;
  const INF = WIN * 2;
  const ABORT = { abort: true };
  const BOMB_VALUE = 40;

  // depth : coups calculés à l'avance · err : chance de jouer au hasard · ms : temps maximum · tact : voit les menaces en bout de calcul
  const LEVELS = [
    null,
    { name: "Bébé", depth: 0, err: 1, ms: 0, note: "joue complètement au hasard" },
    { name: "Distrait", depth: 1, err: 0.55, ms: 40, note: "gagne parfois quand il le peut, ne bloque jamais" },
    { name: "Débutant", depth: 2, err: 0.45, ms: 60, note: "bloque de temps en temps tes menaces" },
    { name: "Apprenti", depth: 2, err: 0.25, ms: 60, note: "voit ton prochain coup, se trompe souvent" },
    { name: "Moyen", depth: 4, err: 0.16, ms: 90, note: "calcule 4 coups, se trompe parfois" },
    { name: "Malin", depth: 5, err: 0.07, ms: 140, note: "calcule 5 coups, erreurs assez rares" },
    { name: "Fort", depth: 7, err: 0.03, ms: 280, tact: true, note: "calcule 7 coups et voit les menaces" },
    { name: "Expert", depth: 10, err: 0.01, ms: 550, tact: true, note: "calcule 10 coups, presque aucune erreur" },
    { name: "Maître", depth: 14, err: 0, ms: 1000, tact: true, note: "calcule 14 coups, aucune erreur volontaire" },
    { name: "Turbonix", depth: 64, err: 0, ms: 2600, tact: true, note: "calcule le plus loin possible pendant 2,6 secondes" },
  ];

  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const weights = (win) => {
    const w = [0];
    for (let k = 1; k <= win; k++) w.push(Math.round(Math.pow(5, k - 1)));
    return w;
  };

  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };

  // --- Recherche rapide --------------------------------------------------------

  const TT_BITS = 19;
  const TT_SIZE = 1 << TT_BITS;
  let ttLock = null, ttVal = null, ttInfo = null;

  class FastSearch {
    constructor(state, opts) {
      this.opts = opts;
      const { w, h, o } = state;
      this.cells = w * h;
      this.win = o.win;
      this.misere = o.misere;
      this.tact = !!opts.tact;
      this.W = weights(o.win);
      this.laneN = C4.laneCount(state);
      this.lanes = [];
      for (let l = 0; l < this.laneN; l++) this.lanes.push(Int16Array.from(C4.laneCells(state, l)));
      this.height = new Int16Array(this.laneN);
      this.own = Int8Array.from(state.own);
      this.turn = state.turn;
      this.filled = 0;
      this.nodes = 0;
      this.deadline = Infinity;

      // Les lignes encore possibles, sans celles qui passent par un obstacle
      const all = C4.windows(w, h, o.win).filter((line) => line.every((c) => state.own[c] !== C4.WALL));
      this.nWin = all.length;
      this.cellWin = Array.from({ length: this.cells }, () => []);
      all.forEach((line, i) => line.forEach((c) => this.cellWin[c].push(i)));
      this.cellWin = this.cellWin.map((a) => Int32Array.from(a));
      this.cnt = [new Int8Array(this.nWin), new Int8Array(this.nWin)];
      this.score = 0;

      const rnd = mulberry(w * 131 + h * 17 + o.win);
      this.zLo = [new Int32Array(this.cells), new Int32Array(this.cells)];
      this.zHi = [new Int32Array(this.cells), new Int32Array(this.cells)];
      for (let p = 0; p < 2; p++) for (let c = 0; c < this.cells; c++) { this.zLo[p][c] = rnd(); this.zHi[p][c] = rnd(); }
      this.hLo = 0;
      this.hHi = 0;
      this.turnKey = rnd();

      for (let l = 0; l < this.laneN; l++) {
        const cells = this.lanes[l];
        let k = 0;
        while (k < cells.length && state.own[cells[k]] !== C4.EMPTY) k++;
        this.height[l] = k;
      }
      for (let c = 0; c < this.cells; c++) {
        const v = state.own[c];
        if (v === C4.EMPTY) continue;
        this.filled++;
        if (v >= 0) this.addToken(c, v);
      }

      // Les couloirs du centre d'abord
      const mid = (this.laneN - 1) / 2;
      this.order = [...Array(this.laneN).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      this.hist = new Int32Array(this.cells * 2);
      this.plyMoves = Array.from({ length: this.cells + 4 }, () => new Int16Array(this.laneN));
      this.plyScore = Array.from({ length: this.cells + 4 }, () => new Int32Array(this.laneN));

      if (!ttLock) {
        ttLock = new Int32Array(TT_SIZE);
        ttVal = new Int32Array(TT_SIZE);
        ttInfo = new Int32Array(TT_SIZE);
      }
      ttInfo.fill(0);
    }

    addToken(c, me) {
      const opp = 1 - me;
      const sign = me === 0 ? 1 : -1;
      const list = this.cellWin[c];
      const mine = this.cnt[me], theirs = this.cnt[opp];
      let line = false;
      for (let i = 0; i < list.length; i++) {
        const k = list[i];
        const a = mine[k], b = theirs[k];
        if (b === 0) {
          this.score += sign * (this.W[a + 1] - this.W[a]);
          if (a + 1 === this.win) line = true;
        } else if (a === 0) {
          this.score += sign * this.W[b];
        }
        mine[k] = a + 1;
      }
      this.hLo ^= this.zLo[me][c];
      this.hHi ^= this.zHi[me][c];
      return line;
    }

    removeToken(c, me) {
      const list = this.cellWin[c];
      const mine = this.cnt[me];
      for (let i = 0; i < list.length; i++) mine[list[i]]--;
      this.hLo ^= this.zLo[me][c];
      this.hHi ^= this.zHi[me][c];
    }

    // Ce pion complèterait-il une ligne pour ce joueur ?
    completes(c, p) {
      const list = this.cellWin[c];
      const mine = this.cnt[p], theirs = this.cnt[1 - p];
      const need = this.win - 1;
      for (let i = 0; i < list.length; i++) {
        const k = list[i];
        if (mine[k] === need && theirs[k] === 0) return true;
      }
      return false;
    }

    evaluate() {
      const v = this.turn === 0 ? this.score : -this.score;
      return this.misere ? -v : v;
    }

    neg(depth, alpha, beta, ply) {
      if ((++this.nodes & 2047) === 0 && now() > this.deadline) throw ABORT;
      if (this.filled >= this.cells) return 0;

      const me = this.turn, opp = 1 - me;
      const laneN = this.laneN;
      if (depth <= 0 && !this.tact) return this.evaluate();

      let forced = -1;
      if (!this.misere) {
        let threats = 0;
        for (let l = 0; l < laneN; l++) {
          if (this.height[l] >= this.lanes[l].length) continue;
          const c = this.lanes[l][this.height[l]];
          if (this.completes(c, me)) return WIN - ply - 1;
          if (this.completes(c, opp)) { threats++; forced = l; }
        }
        if (threats >= 2) return -(WIN - ply - 2);
      }
      if (depth <= 0 && forced < 0) return this.evaluate();

      // Table de transposition
      const lo = this.hLo ^ (me ? this.turnKey : 0);
      const hi = this.hHi;
      const slot = lo & (TT_SIZE - 1);
      let ttMove = -1;
      const info = ttInfo[slot];
      if (info !== 0 && ttLock[slot] === hi) {
        const d = (info >> 8) & 255;
        const flag = (info >> 16) & 3;
        ttMove = (info & 255) - 1;
        if (d >= depth && forced < 0) {
          let v = ttVal[slot];
          if (v > DECIDED) v -= ply; else if (v < -DECIDED) v += ply;
          if (flag === 0) return v;
          if (flag === 1 && v >= beta) return v;
          if (flag === 2 && v <= alpha) return v;
        }
      }

      const moves = this.plyMoves[ply];
      const keys = this.plyScore[ply];
      let n = 0;
      if (forced >= 0) {
        moves[n++] = forced;
      } else {
        for (let i = 0; i < laneN; i++) {
          const l = this.order[i];
          if (this.height[l] >= this.lanes[l].length) continue;
          const c = this.lanes[l][this.height[l]];
          let key = this.hist[c * 2 + me] + (laneN - i);
          if (l === ttMove) key = 1 << 30;
          // Tri par insertion
          let j = n++;
          while (j > 0 && keys[j - 1] < key) { keys[j] = keys[j - 1]; moves[j] = moves[j - 1]; j--; }
          keys[j] = key;
          moves[j] = l;
        }
      }

      const alpha0 = alpha;
      let best = -INF, bestMove = moves[0];
      const nextDepth = forced >= 0 ? depth : depth - 1; // Un coup forcé ne compte pas dans le calcul
      for (let i = 0; i < n; i++) {
        const l = moves[i];
        const c = this.lanes[l][this.height[l]];
        const saved = this.score;
        this.height[l]++;
        this.own[c] = me;
        this.filled++;
        const line = this.addToken(c, me);
        let v;
        if (line) {
          v = this.misere ? -(WIN - ply - 1) : WIN - ply - 1;
        } else {
          this.turn = opp;
          v = -this.neg(nextDepth, -beta, -alpha, ply + 1);
          this.turn = me;
        }
        this.removeToken(c, me);
        this.score = saved;
        this.filled--;
        this.own[c] = C4.EMPTY;
        this.height[l]--;
        if (v > best) { best = v; bestMove = l; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) {
          this.hist[c * 2 + me] += depth * depth;
          break;
        }
      }

      let store = best;
      if (store > DECIDED) store += ply; else if (store < -DECIDED) store -= ply;
      ttLock[slot] = hi;
      ttVal[slot] = store;
      const flag = best <= alpha0 ? 2 : best >= beta ? 1 : 0;
      ttInfo[slot] = (bestMove + 1) | (Math.min(255, Math.max(0, depth)) << 8) | (flag << 16) | (1 << 20);
      return best;
    }

    // Note un coup à la racine
    rootEval(l, depth, alpha) {
      const me = this.turn;
      const c = this.lanes[l][this.height[l]];
      const saved = this.score;
      this.height[l]++;
      this.own[c] = me;
      this.filled++;
      const line = this.addToken(c, me);
      let v;
      try {
        if (line) v = this.misere ? -(WIN - 1) : WIN - 1;
        else {
          this.turn = 1 - me;
          v = -this.neg(depth - 1, -INF, -alpha, 1);
        }
      } finally {
        this.turn = me;
        this.removeToken(c, me);
        this.score = saved;
        this.filled--;
        this.own[c] = C4.EMPTY;
        this.height[l]--;
      }
      return v;
    }

    legal() {
      const out = [];
      for (let i = 0; i < this.laneN; i++) {
        const l = this.order[i];
        if (this.height[l] < this.lanes[l].length) out.push(l);
      }
      return out;
    }

    run() {
      const { depth: maxDepth, ms, full } = this.opts;
      this.deadline = ms ? now() + ms : Infinity;
      let list = this.legal().map((m) => ({ m, v: 0 }));
      if (!list.length) return { best: -1, score: 0, depth: 0, scores: [] };
      let result = list.slice();
      let reached = 0;
      const remaining = this.cells - this.filled;
      for (let d = 1; d <= maxDepth; d++) {
        const scores = [];
        try {
          let alpha = -INF;
          for (const entry of list) {
            const v = this.rootEval(entry.m, d, full ? -INF : alpha);
            scores.push({ m: entry.m, v });
            if (v > alpha) alpha = v;
          }
        } catch (e) {
          if (e !== ABORT) throw e;
          break;
        }
        scores.sort((a, b) => b.v - a.v);
        result = scores;
        list = scores;
        reached = d;
        if (Math.abs(scores[0].v) > DECIDED && !full) break;
        if (full && scores.every((s) => Math.abs(s.v) > DECIDED)) break;
        if (d >= remaining) break;
        if (this.nodes && ms && now() > this.deadline) break;
      }
      return { best: result[0].m, score: result[0].v, depth: reached, scores: result };
    }
  }

  // --- Recherche générale ------------------------------------------------------

  const windowCache = new Map();
  function flatWindows(w, h, win) {
    const key = w + "x" + h + "x" + win;
    let v = windowCache.get(key);
    if (!v) {
      v = Int16Array.from(C4.windows(w, h, win).flat());
      windowCache.set(key, v);
    }
    return v;
  }

  class GeneralSearch {
    constructor(state, opts) {
      this.state = state;
      this.opts = opts;
      this.rootP = state.turn;
      this.W = weights(state.o.win);
      this.nodes = 0;
      this.deadline = Infinity;
      this.tt = new Map();
    }

    evaluate(s) {
      const { o } = s;
      const list = flatWindows(s.w, s.h, o.win);
      const win = o.win, own = s.own, W = this.W, me = this.rootP;
      let score = 0;
      for (let i = 0; i < list.length; i += win) {
        let who = -1, k = 0, dead = false;
        for (let j = 0; j < win; j++) {
          const v = own[list[i + j]];
          if (v === C4.EMPTY) continue;
          if (v < 0 || (who >= 0 && v !== who)) { dead = true; break; }
          who = v;
          k++;
        }
        if (dead || who < 0) continue;
        if (!s.alive[who]) continue;
        if (who === me) score += W[k]; else score -= W[k];
      }
      if (o.misere) score = -score;
      for (let p = 0; p < s.bombs.length; p++) {
        if (s.bombs[p] > 0) score += (p === me ? BOMB_VALUE : -BOMB_VALUE);
      }
      return score;
    }

    hash(s) {
      let a = 0x811c9dc5 ^ s.turn, b = s.w * 31 + s.turn;
      const own = s.own, id = s.id;
      const limit = s.o.limit > 0;
      for (let c = 0; c < own.length; c++) {
        const v = own[c] + 3;
        a = Math.imul(a ^ v, 16777619);
        b = (Math.imul(b, 33) + v) | 0;
        if (limit && own[c] >= 0) a = Math.imul(a ^ id[c], 16777619);
      }
      if (s.o.rotate) a ^= (s.moves % s.o.rotate) << 7;
      for (let p = 0; p < s.bombs.length; p++) b = (Math.imul(b, 5) + s.bombs[p] + (s.alive[p] ? 2 : 0)) | 0;
      return (a >>> 0) * 2097152 + ((b >>> 0) & 2097151);
    }

    // En mode sans gravité, on ne regarde que les cases proches des pions déjà posés
    placements(s) {
      if (s.o.gravity !== "none") {
        const moves = C4.legalMoves(s);
        const mid = (C4.laneCount(s) - 1) / 2;
        return moves.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      }
      const { w, h, own } = s;
      const near = new Uint8Array(w * h);
      let any = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (own[x + y * w] === C4.EMPTY) continue;
          any = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) near[nx + ny * w] = 1;
          }
        }
      }
      const out = [];
      const mx = (w - 1) / 2, my = (h - 1) / 2;
      for (let c = 0; c < own.length; c++) {
        if (own[c] === C4.EMPTY && (near[c] || !any)) out.push(c);
      }
      const d = (c) => Math.abs((c % w) - mx) + Math.abs(((c / w) | 0) - my);
      return out.sort((a, b) => d(a) - d(b));
    }

    // Les quelques pions adverses les plus utiles à faire exploser
    bombChoices(s) {
      const moves = C4.bombMoves(s);
      if (moves.length <= 6) return moves;
      const { w, h, own } = s;
      const value = (m) => {
        const c = m - C4.BOMB, x = c % w, y = (c / w) | 0, p = own[c];
        let k = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h && own[nx + ny * w] === p) k++;
        }
        return k;
      };
      return moves.map((m) => [value(m), m]).sort((a, b) => b[0] - a[0]).slice(0, 6).map((e) => e[1]);
    }

    search(s, depth, alpha, beta, ply) {
      if ((++this.nodes & 255) === 0 && now() > this.deadline) throw ABORT;
      const me = this.rootP;
      if (s.over) {
        if (s.winner === me) return WIN - ply;
        return s.winner < 0 ? 0 : -(WIN - ply);
      }
      if (!s.alive[me]) return -(WIN - ply);
      if (depth <= 0) return this.evaluate(s);

      const key = this.hash(s);
      const hit = this.tt.get(key);
      let ttMove = -1;
      if (hit) {
        ttMove = hit.m;
        if (hit.d >= depth) {
          if (hit.f === 0) return hit.v;
          if (hit.f === 1 && hit.v >= beta) return hit.v;
          if (hit.f === 2 && hit.v <= alpha) return hit.v;
        }
      }

      let moves = this.placements(s);
      if (ply <= 1 && s.bombs[s.turn] > 0) moves = moves.concat(this.bombChoices(s));
      if (!moves.length) return 0;
      if (ttMove >= 0) {
        const at = moves.indexOf(ttMove);
        if (at > 0) { moves.splice(at, 1); moves.unshift(ttMove); }
      }

      const maximizing = s.turn === me;
      const a0 = alpha, b0 = beta;
      let best = maximizing ? -INF : INF, bestMove = moves[0];
      for (const m of moves) {
        const next = C4.clone(s);
        C4.apply(next, m);
        const v = this.search(next, depth - 1, alpha, beta, ply + 1);
        if (maximizing) {
          if (v > best) { best = v; bestMove = m; }
          if (v > alpha) alpha = v;
        } else {
          if (v < best) { best = v; bestMove = m; }
          if (v < beta) beta = v;
        }
        if (alpha >= beta) break;
      }
      if (this.tt.size > 300000) this.tt.clear();
      if (Math.abs(best) < DECIDED) {
        this.tt.set(key, { d: depth, v: best, m: bestMove, f: best <= a0 ? 2 : best >= b0 ? 1 : 0 });
      }
      return best;
    }

    run() {
      const { depth: maxDepth, ms, full, must } = this.opts;
      this.deadline = ms ? now() + ms : Infinity;
      const s = this.state;
      let moves = this.placements(s);
      if (s.bombs[s.turn] > 0) moves = moves.concat(this.bombChoices(s));
      if (must != null && must < C4.SURRENDER && !moves.includes(must)) moves.push(must);
      if (!moves.length) return { best: -1, score: 0, depth: 0, scores: [] };
      let list = moves.map((m) => ({ m, v: 0 }));
      let result = list.slice();
      let reached = 0;
      for (let d = 1; d <= maxDepth; d++) {
        const scores = [];
        try {
          let alpha = -INF;
          for (const entry of list) {
            const next = C4.clone(s);
            C4.apply(next, entry.m);
            const v = this.search(next, d - 1, full ? -INF : alpha, INF, 1);
            scores.push({ m: entry.m, v });
            if (v > alpha) alpha = v;
          }
        } catch (e) {
          if (e !== ABORT) throw e;
          break;
        }
        scores.sort((a, b) => b.v - a.v);
        result = scores;
        list = scores;
        reached = d;
        if (Math.abs(scores[0].v) > DECIDED && !full) break;
        if (ms && now() > this.deadline) break;
      }
      return { best: result[0].m, score: result[0].v, depth: reached, scores: result };
    }
  }

  // --- Ce que le reste du site utilise ------------------------------------------

  function canUseFast(s) {
    const o = s.o;
    return o.players === 2 && o.gravity !== "none" && !o.limit && !o.crush && !o.rotate &&
      s.bombs[0] <= 0 && s.bombs[1] <= 0 && s.alive[0] && s.alive[1];
  }

  function search(state, opts) {
    const Engine = canUseFast(state) ? FastSearch : GeneralSearch;
    return new Engine(state, opts).run();
  }

  // Ce que ce joueur voit vraiment : avec le brouillard, l'ordi ne triche pas
  const viewOf = (state) => (state.o.fog ? C4.belief(state, state.turn) : state);

  function randomMove(state) {
    const moves = C4.legalMoves(state);
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Le coup de l'ordi pour un niveau donné
  function chooseMove(state, level, msCap = 0) {
    const L = LEVELS[level] || LEVELS[5];
    const view = viewOf(state);
    const legal = C4.legalMoves(view);
    if (!legal.length) return -1;
    if (L.depth === 0 || Math.random() < L.err) return randomMove(view);
    const ms = msCap ? Math.min(msCap, L.ms) : L.ms;
    const shallow = L.depth <= 6;
    const r = search(view, { depth: L.depth, ms, tact: L.tact, full: shallow });
    if (r.best < 0) return randomMove(view);
    // À égalité, on varie pour que les parties ne se ressemblent pas toutes
    if (shallow) {
      const top = r.scores.filter((e) => e.v >= r.score - (Math.abs(r.score) > DECIDED ? 0 : 2));
      return top[Math.floor(Math.random() * top.length)].m;
    }
    return r.best;
  }

  // L'indice : le meilleur coup selon ce que le joueur a le droit de voir
  function hint(state, ms = 900) {
    const r = search(viewOf(state), { depth: 64, ms, tact: true });
    return { move: r.best, score: r.score, depth: r.depth };
  }

  // Note tous les coups d'une position (pour l'analyse de partie)
  function analyze(state, ms = 300, must = null) {
    return search(state, { depth: 64, ms, tact: true, full: true, must });
  }

  // Les coups qui gagnent de force en au plus « plies » demi-coups (pour les puzzles)
  function forcedWins(state, plies) {
    const r = search(state, { depth: plies, tact: true, full: true });
    return r.scores.filter((e) => e.v >= WIN - plies).map((e) => ({ m: e.m, in: WIN - e.v }));
  }

  // La meilleure défense : le coup qui retarde le plus la défaite
  function bestDefense(state, plies) {
    const r = search(state, { depth: plies, tact: true, full: true });
    return r.best;
  }

  // Joue une partie entière sans animation (tournoi : matchs simulés entre ordis)
  function simulate(options, starter, levels, msCap = 40) {
    const s = C4.create(options, starter);
    const moves = [];
    while (!s.over) {
      const m = chooseMove(s, levels[s.turn], msCap);
      if (m < 0) break;
      C4.apply(s, m);
      moves.push(m);
    }
    return { winner: s.winner, reason: s.reason, moves };
  }

  const api = { LEVELS, WIN, DECIDED, chooseMove, hint, analyze, forcedWins, bestDefense, simulate, search, randomMove, canUseFast };
  root.C4AI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // --- Appels depuis la page (dans un Worker si possible) -----------------------

  if (typeof document === "undefined") return;

  const run = (cmd, a) => {
    switch (cmd) {
      case "move": return chooseMove(a.state, a.level, a.msCap);
      case "hint": return hint(a.state, a.ms);
      case "analyze": return analyze(a.state, a.ms, a.must);
      case "simulate": return simulate(a.options, a.starter, a.levels, a.msCap);
    }
    return null;
  };

  let worker = null;
  let workerBroken = false;
  let seq = 0;
  const waiting = new Map();

  function spawn() {
    if (worker || workerBroken) return;
    try {
      worker = new Worker("js/ai-worker.js");
      worker.onmessage = (e) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        job.resolve(e.data.result);
      };
      worker.onerror = () => {
        workerBroken = true;
        worker = null;
        const jobs = [...waiting.values()];
        waiting.clear();
        jobs.forEach((j) => j.resolve(run(j.cmd, slowdown(j.args))));
      };
    } catch (e) {
      // Ouvert depuis un simple fichier : le navigateur interdit les Workers
      workerBroken = true;
      worker = null;
    }
  }

  // Sans Worker, on réfléchit moins longtemps pour ne pas figer la page
  function slowdown(args) {
    const a = Object.assign({}, args);
    if (a.ms) a.ms = Math.min(a.ms, 250);
    if ("level" in a) a.msCap = Math.min(a.msCap || 400, 400);
    if (a.msCap) a.msCap = Math.min(a.msCap, 60);
    return a;
  }

  // Sans le Map des positions déjà vues, inutile pour l'ordi
  function pack(args) {
    if (!args.state) return args;
    const copy = Object.assign({}, args);
    copy.state = Object.assign({}, args.state, { seen: null });
    return copy;
  }

  api.ask = function (cmd, args) {
    spawn();
    if (!worker) {
      return new Promise((resolve) => setTimeout(() => resolve(run(cmd, slowdown(args))), 20));
    }
    return new Promise((resolve) => {
      const id = ++seq;
      waiting.set(id, { resolve, cmd, args });
      worker.postMessage({ id, cmd, args: pack(args) });
    });
  };

  // Arrête tout de suite ce que l'ordi calculait (nouvelle partie, annulation…)
  api.cancel = function () {
    if (worker) { worker.terminate(); worker = null; }
    waiting.forEach((job) => job.resolve(null));
    waiting.clear();
  };
})(typeof self !== "undefined" ? self : globalThis);
