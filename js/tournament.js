// ===== Le tournoi : élimination directe de 2 à 16 joueurs, et son tableau animé =====

const Tournament = (() => {
  // L'ordre classique des têtes de série : le 1 et le 2 ne se croisent qu'en finale
  function seedOrder(size) {
    let order = [0];
    while (order.length < size) {
      const n = order.length * 2;
      const next = [];
      order.forEach((s) => { next.push(s, n - 1 - s); });
      order = next;
    }
    return order;
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // entries : [{ name, human, level, color, skin }]
  function create(entries) {
    const players = shuffle(entries);
    let size = 2;
    while (size < players.length) size *= 2;
    const nRounds = Math.log2(size);
    const rounds = [];
    for (let r = 0; r < nRounds; r++) {
      const count = size >> (r + 1);
      rounds.push(Array.from({ length: count }, () => ({ a: null, b: null, w: null, bye: false })));
    }
    const order = seedOrder(size);
    for (let i = 0; i < size; i += 2) {
      const m = rounds[0][i / 2];
      const pa = order[i], pb = order[i + 1];
      m.a = pa < players.length ? pa : null;
      m.b = pb < players.length ? pb : null;
    }
    const t = { players, rounds, champion: null, fresh: null };
    // Ceux qui n'ont pas d'adversaire passent directement au tour suivant
    rounds[0].forEach((m, i) => {
      if (m.a === null || m.b === null) {
        m.bye = true;
        m.w = m.a !== null ? m.a : m.b;
        advance(t, 0, i);
      }
    });
    return t;
  }

  function advance(t, r, i) {
    const m = t.rounds[r][i];
    if (r + 1 >= t.rounds.length) { t.champion = m.w; return; }
    const next = t.rounds[r + 1][i >> 1];
    if (i % 2 === 0) next.a = m.w; else next.b = m.w;
  }

  // Le prochain match à jouer
  function nextMatch(t) {
    for (let r = 0; r < t.rounds.length; r++) {
      for (let i = 0; i < t.rounds[r].length; i++) {
        const m = t.rounds[r][i];
        if (m.w === null && m.a !== null && m.b !== null) return { r, i, m };
      }
    }
    return null;
  }

  function report(t, r, i, winner) {
    const m = t.rounds[r][i];
    m.w = winner;
    t.fresh = `${r}-${i}`;
    advance(t, r, i);
  }

  function roundName(t, r) {
    const left = t.rounds.length - r;
    if (left === 1) return "Finale";
    if (left === 2) return "Demi-finales";
    if (left === 3) return "Quarts de finale";
    return "Huitièmes de finale";
  }

  // Le classement final : champion, finaliste, demi-finalistes
  function podium(t) {
    if (t.champion === null) return [];
    const out = [t.champion];
    const last = t.rounds.length - 1;
    const f = t.rounds[last][0];
    out.push(f.a === t.champion ? f.b : f.a);
    if (last > 0) {
      t.rounds[last - 1].forEach((m) => {
        if (m.a === null || m.b === null) return;
        out.push(m.a === m.w ? m.b : m.a);
      });
    }
    return out;
  }

  // --- Le tableau ------------------------------------------------------------------

  function slotEl(t, id, match, side) {
    const row = document.createElement("div");
    row.className = "b-slot";
    if (id === null) {
      row.classList.add("empty");
      row.innerHTML = `<span class="b-name">${match.bye ? "exempt" : "—"}</span>`;
      return row;
    }
    const p = t.players[id];
    row.appendChild(Fx.miniToken(p.color, p.skin));
    const name = document.createElement("span");
    name.className = "b-name";
    name.textContent = p.name;
    row.appendChild(name);
    if (!p.human) {
      const lv = document.createElement("span");
      lv.className = "lv-num";
      lv.textContent = p.level;
      row.appendChild(lv);
    }
    if (match.w !== null) row.classList.add(match.w === id ? "won" : "lost");
    row.dataset.side = side;
    return row;
  }

  function render(t, el) {
    el.innerHTML = "";
    const cur = nextMatch(t);
    t.rounds.forEach((round, r) => {
      const col = document.createElement("div");
      col.className = "b-col";
      col.style.setProperty("--r", r);
      const head = document.createElement("div");
      head.className = "b-head";
      head.textContent = roundName(t, r);
      col.appendChild(head);
      const body = document.createElement("div");
      body.className = "b-body";
      round.forEach((m, i) => {
        const box = document.createElement("div");
        box.className = "b-match";
        box.style.setProperty("--k", i);
        if (m.bye) box.classList.add("bye");
        if (cur && cur.r === r && cur.i === i) box.classList.add("current");
        if (t.fresh === `${r}-${i}`) box.classList.add("fresh");
        if (m.w !== null) box.classList.add("done");
        // Le trait qui relie au tour suivant
        box.classList.add(i % 2 === 0 ? "top" : "bottom");
        const inner = document.createElement("div");
        inner.className = "b-card";
        inner.appendChild(slotEl(t, m.a, m, "a"));
        inner.appendChild(slotEl(t, m.b, m, "b"));
        box.appendChild(inner);
        body.appendChild(box);
      });
      col.appendChild(body);
      el.appendChild(col);
    });
    const end = document.createElement("div");
    end.className = "b-col b-end";
    end.style.setProperty("--r", t.rounds.length);
    end.innerHTML = `<div class="b-head">Champion</div>`;
    const body = document.createElement("div");
    body.className = "b-body";
    const crown = document.createElement("div");
    crown.className = "b-champion" + (t.champion !== null ? " on" : "");
    if (t.champion !== null) {
      const p = t.players[t.champion];
      crown.innerHTML = `<span class="b-trophy">🏆</span>`;
      const n = document.createElement("strong");
      n.textContent = p.name;
      crown.appendChild(n);
    } else {
      crown.innerHTML = `<span class="b-trophy off">🏆</span><small class="muted">À toi de jouer</small>`;
    }
    body.appendChild(crown);
    end.appendChild(body);
    el.appendChild(end);
    t.fresh = null;
  }

  return { create, nextMatch, report, roundName, podium, render };
})();
