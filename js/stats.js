// ===== Les statistiques, rangées par joueur (son nom) =====

const Stats = (() => {
  const KEY = "c4-stats";
  const VERSION = 1;
  const GOLD_AT = 10;
  const HISTORY_MAX = 200;
  let data = { v: VERSION, players: {} };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.players) data = raw;
    } catch (e) { /* sauvegarde illisible : on repart de zéro */ }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* stockage indisponible */ }
  }

  function blank() {
    return { games: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, trophies: 0, gold: false, first: {}, cols: {}, levels: {} };
  }

  const get = (name) => data.players[name] || null;
  const names = () => Object.keys(data.players).sort((a, b) => data.players[b].games - data.players[a].games);
  const hasGold = (name) => !!(data.players[name] && data.players[name].gold);
  const streakOf = (name) => (data.players[name] ? data.players[name].streak : 0);

  // Enregistre le résultat d'un joueur humain. Renvoie vrai s'il vient de débloquer l'or.
  function record(name, result, info) {
    const p = data.players[name] || (data.players[name] = blank());
    let unlocked = false;
    p.games++;
    if (result === "w") {
      p.wins++;
      p.streak++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      if (p.streak >= GOLD_AT && !p.gold) { p.gold = true; unlocked = true; }
    } else {
      p.streak = 0;
      if (result === "l") p.losses++; else p.draws++;
    }
    if (info.firstCol != null) p.first[info.firstCol] = (p.first[info.firstCol] || 0) + 1;
    (info.cols || []).forEach((c) => { p.cols[c] = (p.cols[c] || 0) + 1; });
    if (info.level) {
      const l = p.levels[info.level] || (p.levels[info.level] = { g: 0, w: 0, l: 0, d: 0, streak: 0, best: 0, lastWin: null, history: [] });
      l.g++;
      if (result === "w") {
        l.w++;
        l.streak++;
        l.best = Math.max(l.best, l.streak);
        l.lastWin = Date.now();
      } else {
        l.streak = 0;
        if (result === "l") l.l++; else l.d++;
      }
      l.history.unshift({ r: result, at: Date.now(), grid: info.grid, modes: info.modes });
      if (l.history.length > HISTORY_MAX) l.history.length = HISTORY_MAX;
    }
    save();
    return unlocked;
  }

  function addTrophy(name) {
    const p = data.players[name] || (data.players[name] = blank());
    p.trophies++;
    save();
  }

  function clearPlayer(name) { delete data.players[name]; save(); }
  function clearAll() { data = { v: VERSION, players: {} }; save(); }
  function exportData() { return data; }
  function importData(raw) {
    if (raw && raw.players && typeof raw.players === "object") { data = raw; save(); return true; }
    return false;
  }

  load();
  return { GOLD_AT, get, names, hasGold, streakOf, record, addTrophy, clearPlayer, clearAll, exportData, importData };
})();
