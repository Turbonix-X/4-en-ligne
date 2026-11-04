// ===== Les puzzles de l'entraînement =====
// Positions tirées de vraies parties, puis vérifiées par le calcul : chaque puzzle n'a qu'un seul premier coup juste.
// X est toujours le joueur qui doit jouer. r = la grille, s = la colonne qui résout, n = coups pour gagner (0 = trouver le seul coup qui sauve).

const PUZZLES = (() => {
  const groups = [
    {
      key: "win1", icon: "🎯", title: "Gagne en 1 coup", goal: "Trouve le coup qui gagne tout de suite.",
      list: [
        { r: [".......", ".......", "...X...", "...OO.X", "...OO.X", "XO.OXOX"], s: 6, n: 1 },
        { r: [".......", ".......", ".......", "...XO..", "O..XX..", "OO.XO.."], s: 3, n: 1 },
        { r: [".......", ".......", "....O..", "...XO..", ".O.XX..", ".O.XXO."], s: 3, n: 1 },
        { r: [".......", "....O..", "...OO..", "..XXX..", "XXOXO..", "XOOOX.O"], s: 1, n: 1 },
      ],
    },
    {
      key: "win2", icon: "⚔️", title: "Gagne en 2 coups", goal: "Crée deux menaces à la fois : l’adversaire n’en bloquera qu’une.",
      list: [
        { r: [".......", "....O..", "...OO..", "...XX..", "XXOXO..", "XOOOX.."], s: 2, n: 2 },
        { r: ["....O..", "...XX..", "..XOOXX", "X.OXOOO", "O.XOOXO", "XOOXXOX"], s: 5, n: 2 },
        { r: ["....O..", "O.XXXO.", "X.XOOXX", "XOOXOOO", "OXXOOXO", "XOOXXOX"], s: 1, n: 2 },
        { r: [".....O.", ".O...O.", ".X.X.O.", ".XXO.X.", ".OOXXX.", ".OXOOX."], s: 6, n: 2 },
        { r: [".......", ".......", ".O...X.", ".XX..O.", ".OXXOO.", ".XOOXO."], s: 3, n: 2 },
        { r: [".......", "..O....", "OOO.XX.", "XOX.OX.", "XXXOOO.", "XOXOOX."], s: 5, n: 2 },
        { r: [".......", "...O...", "...O...", "...X...", "...O.X.", ".X.X.O."], s: 2, n: 2 },
      ],
    },
    {
      key: "win3", icon: "🧠", title: "Gagne en 3 coups", goal: "Force les réponses de l’adversaire jusqu’à la victoire.",
      list: [
        { r: [".......", "...X...", "...XO..", "O.OOX..", "X.XXOO.", "X.XOOOX"], s: 2, n: 3 },
        { r: [".XX..O.", ".XO.OXO", "XOX.OXX", "XXXOXOO", "OOXXOOX", "OXOOXOO"], s: 4, n: 3 },
        { r: [".......", ".......", "X.X....", "OXO....", "OOX.XO.", "OXOOXXO"], s: 1, n: 3 },
        { r: [".......", ".......", "..O....", "..X....", "XOXXOO.", "OXXOOXO"], s: 3, n: 3 },
        { r: ["....O..", "....X..", "..OXXO.", "O.XOXX.", "XOXXOOO", "OXXOOXO"], s: 5, n: 3 },
        { r: [".X.....", ".O.....", ".O.OOO.", ".O.XXX.", ".X.OXX.", "OO.XXO."], s: 6, n: 3 },
        { r: [".X.OO..", ".O.XX..", ".O.OOO.", ".O.XXX.", ".X.OXX.", "OO.XXO."], s: 6, n: 3 },
      ],
    },
    {
      key: "win4", icon: "👑", title: "Gagne en 4 coups", goal: "Pour les vrais stratèges : prévois 7 coups à l’avance.",
      list: [
        { r: ["..OX.X.", "..OO.X.", "..OO.OX", "..XX.XO", "..OX.XO", "OOXOXXO"], s: 1, n: 4 },
        { r: [".XX..O.", ".XO.OX.", "XOX.OX.", "XXXOXOO", "OOXXOOX", "OXOOXOO"], s: 6, n: 4 },
        { r: [".......", ".......", "..O....", "..X....", "X.XXOO.", "O.XOOXO"], s: 1, n: 4 },
        { r: [".......", "..O....", "..X....", "..XXO..", "O.XOX..", "XOOOXOX"], s: 3, n: 4 },
        { r: [".......", ".......", ".......", "....O..", ".X..XO.", "XXOOOX."], s: 2, n: 4 },
        { r: [".....O.", ".....X.", ".O...O.", ".X...O.", ".XXX.O.", ".XOO.X."], s: 2, n: 4 },
      ],
    },
    {
      key: "save", icon: "🛡️", title: "Sauve ta peau", goal: "Un seul coup t’évite de perdre : trouve-le.",
      list: [
        { r: [".......", ".......", ".......", "...O...", "...OO.X", "XO.OX.X"], s: 3, n: 0 },
        { r: [".......", ".......", "...O...", "...XX.O", "...XX.O", "OX.XO.O"], s: 6, n: 0 },
        { r: [".......", ".......", ".......", "...OX..", "...OO..", "XX.OX.."], s: 3, n: 0 },
        { r: [".......", ".......", "....X..", "...OX..", "...OO..", ".X.OOX."], s: 3, n: 0 },
        { r: [".......", ".......", "...XX..", "...OO..", "O..OX..", "OXXXO.."], s: 1, n: 0 },
        { r: [".......", ".......", "..O....", "..X.X..", "..X.O..", "..XOOO."], s: 6, n: 0 },
      ],
    },
    {
      key: "misere", icon: "🙃", title: "Mode inversé", goal: "Ici, aligner fait perdre. Un seul coup te sauve : trouve-le.",
      opts: { misere: true },
      list: [
        { r: ["OO....X", "XX..O.O", "OO..X.X", "XO..O.O", "OX.XOXX", "OO.XXXO"], s: 4, n: 0 },
        { r: ["...O.XO", "...XOOX", "..XOOXO", "..XXXOX", "XOOOXXO", "XOXOOOX"], s: 4, n: 0 },
        { r: ["OX.X...", "XO.O..O", "OX.X..X", "XO.OO.X", "OXXOXOO", "OXOXXOX"], s: 6, n: 0 },
        { r: ["X....OO", "O....XO", "O.X..OX", "XXX.OXO", "OXX.OOO", "XOOXXXO"], s: 4, n: 0 },
        { r: ["OOO....", "XXX.O..", "OOO.X.X", "XOXXOXX", "XXOOOXO", "OOXXXOO"], s: 4, n: 0 },
      ],
    },
    {
      key: "big", icon: "📐", title: "Grande grille", goal: "Sur une grille de 8×7, gagne en 3 coups.",
      list: [
        { r: ["O.......", "OO......", "XX......", "XX......", "XX.O....", "OO.XXO..", "OXOOOX.."], s: 3, n: 3 },
        { r: ["........", "....X...", "..O.O...", "..XXOO..", "..XOOX..", "..XXXO..", "O.OXOXO."], s: 3, n: 3 },
        { r: ["........", "........", "........", ".O..X..X", "XX.XOO.O", "OX.OXXOO", "OX.XOOXO"], s: 6, n: 3 },
      ],
    },
  ];
  groups.forEach((g) => g.list.forEach((p, i) => {
    p.id = `${g.key}-${i + 1}`;
    p.opts = g.opts || {};
    p.group = g;
  }));
  return groups;
})();
