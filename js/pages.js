// ===== Pages Règles et Astuces : thème, petites grilles d'exemple, liste des niveaux =====

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("themeBtn").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    const prefs = JSON.parse(localStorage.getItem("tx-prefs")) || {};
    prefs.theme = theme;
    localStorage.setItem("tx-prefs", JSON.stringify(prefs));
  } catch (e) { /* stockage indisponible */ }
});

// Une grille d'exemple. b : "....../..X.../.XOO.." (une ligne par groupe)
// X jaune, O mauve, R rose, V vert, ? = brouillard.
// line : ["x,y", ...] la ligne alignée · mark : cases entourées · bad : ligne rouge · arrow : colonne fléchée · dropped : "x,y" pion fantôme
function demoBoard({ b, line, bad, mark = [], arrow, ghost = [] }) {
  const rows = b.split("/");
  const h = rows.length, w = rows[0].length;
  const c = 40, pad = 10, top = arrow != null ? 26 : 0;
  const W = w * c + pad * 2, H = h * c + pad * 2 + top;
  const colors = { X: ["#ffe45c", "#ffd60a", "#c9a200"], O: ["#c9b0ff", "#9b6dff", "#6f45d9"], R: ["#ff9db0", "#ff4d6d", "#b92a45"], V: ["#8ff5d0", "#2ee6a6", "#16a173"] };
  let holes = "";
  let pieces = "";
  let clouds = "";
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const cx = pad + (x + 0.5) * c, cy = top + pad + (y + 0.5) * c;
    holes += `M${cx - 16} ${cy}a16 16 0 1 0 32 0a16 16 0 1 0 -32 0Z`;
    if (ch === "?") {
      // Le nuage passe par-dessus la façade, d'un seul tenant
      clouds += `<rect x="${cx - 21}" y="${cy - 21}" width="42" height="42" fill="#4a3d70"/>`;
      return;
    }
    if (ch === ".") return;
    const p = colors[ch];
    const faded = ghost.includes(`${x},${y}`);
    pieces += `<circle cx="${cx}" cy="${cy}" r="17" fill="${p[1]}" stroke="${p[2]}" stroke-width="2" opacity="${faded ? 0.4 : 1}"/><circle cx="${cx - 5}" cy="${cy - 6}" r="5" fill="${p[0]}" opacity="${faded ? 0.3 : 0.7}"/>`;
  }));
  const point = (s) => {
    const [x, y] = s.split(",").map(Number);
    return [pad + (x + 0.5) * c, top + pad + (y + 0.5) * c];
  };
  let over = "";
  mark.forEach((m) => {
    const [cx, cy] = point(m);
    over += `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="#ff4d6d" stroke-width="3" stroke-dasharray="5 4"/>`;
  });
  if (line) {
    const [x1, y1] = point(line[0]);
    const [x2, y2] = point(line[line.length - 1]);
    over += `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${bad ? "#ff4d6d" : "#ffffff"}" stroke-width="7" stroke-linecap="round" opacity=".9"/>`;
  }
  if (arrow != null) {
    const cx = pad + (arrow + 0.5) * c;
    over += `<path d="M${cx} 3V19M${cx - 6} 13l6 7l6 -7" fill="none" stroke="#ffd60a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">${arrow != null ? "" : ""}
    ${pieces}
    <path d="M0 ${top}H${W}V${H}H0Z${holes}" fill="#47298f" fill-rule="evenodd"/>
    ${clouds}
    ${over}</svg>`;
}

document.querySelectorAll("[data-demos]").forEach((row) => {
  JSON.parse(row.dataset.demos).forEach((demo) => {
    if (demo.arrowNext) {
      const a = document.createElement("span");
      a.className = "demo-arrow";
      a.textContent = "→";
      row.appendChild(a);
      return;
    }
    const fig = document.createElement("figure");
    fig.className = "demo";
    fig.innerHTML = `${demoBoard(demo)}<figcaption>${demo.t}</figcaption>`;
    row.appendChild(fig);
  });
});

const list = document.getElementById("levelList");
if (list && window.C4AI) {
  for (let l = 1; l <= 10; l++) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="lv-num">${l}</span><span><strong>${C4AI.LEVELS[l].name}</strong> : ${C4AI.LEVELS[l].note}</span>`;
    list.appendChild(li);
  }
}
