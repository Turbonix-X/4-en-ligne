# 4 en ligne

**A NOTER:** Ce site est fait à 100% par Intelligence Artifficielle (ou Super Intelligence pour les intimes).

Le 4 en ligne en 2D ou en vraie 3D, avec un bot à 10 niveaux, un tournoi jusqu'à 16 joueurs, des puzzles, l'analyse de partie et plein de modes qui se combinent.

**Jouer en ligne : https://turbonix-x.github.io/4-en-ligne/**

Ça marche sur ordi, tablette et téléphone, et il n'y a rien à installer.

**Toutes les règles :** page `regles.html` du site. **Les conseils pour gagner :** page `astuces.html`.

## Comment jouer

- 🤖 **Contre l'ordi**, du niveau 1 (Bébé) au niveau 10 (Turbonix).
- 👥 **Entre amis**, à tour de rôle sur le même écran.
- 📺 **Ordi contre ordi** : regarde deux niveaux différents s'affronter.
- 🏆 **Tournoi** : de 2 à 16 participants, humains ou ordis, avec un tableau animé.
- 🧩 **Entraînement** : 38 puzzles, tous vérifiés par le calcul, avec une seule bonne solution.

## La grille

- 5×4, 6×5, 7×6 (la classique), 8×7, 9×8 ou 10×9.
- De 3 à 7 pions à aligner.
- En 2D ou en 3D. En 3D, glisser fait tourner la caméra.

## Les modes (ils se combinent)

- ♻️ **Limité** : un nombre de pions au choix. Au-delà, le plus ancien part et la colonne retombe.
- ⚡ **Éclair** : un temps limité par coup, avec une pause.
- 🧲 **Gravité inversée** : vers le haut, la gauche ou la droite.
- 🔄 **Rotation** : tous les 1 à 10 coups, la grille tourne d'un quart de tour et les pions retombent.
- 🎉 **3 ou 4 joueurs**.
- 💣 **Bombe** : une par partie, pour faire exploser un pion adverse.
- 🙃 **Inversé** : aligner fait perdre.
- 🪨 **Gravité** : un pion avec 3 pions sur lui est écrasé.
- 🌫️ **Brouillard** : on ne voit que les cases autour de ses pions. L'ordi ne triche pas.
- 🪐 **Sans gravité** : on pose son pion où on veut.

## Le reste

- **Pions :** une couleur au choix (7 prêtes, un code, un nom ou la palette) et un style : classique, avec un X, brillant, ou en or pour ceux qui ont gagné 10 fois d'affilée.
- **Qui commence :** un joueur précis, chacun son tour, au hasard, le gagnant ou le perdant.
- **Avant de jouer :** autoriser « Annuler » contre l'ordi, et autoriser les indices.
- **Pendant la partie :** abandonner (pour chaque joueur), pause, plein écran, vitesse des animations.
- **Après la partie :** analyse coup par coup, avec le meilleur coup et la précision de chaque joueur.
- **Statistiques par joueur :** victoires, séries, parties contre chaque niveau avec leurs dates, colonne jouée en premier, colonne la plus jouée. On peut effacer un seul joueur ou tout le jeu.
- **Sauvegarde :** tout est gardé dans le navigateur, même la partie et le tournoi en cours. Le bouton 🔗 crée un lien avec tes réglages, et permet de garder tes données dans un fichier.

## Le clavier

| Touche | Action |
|---|---|
| `1` à `9`, `0` | Jouer dans cette colonne (ça dépend de la grille) |
| `←` `→` puis `Espace` | Choisir une colonne, puis lancer |
| `Z` | Annuler |
| `H` | Indice |
| `B` | Bombe |
| `P` | Pause |
| `F` | Plein écran |
| `R` | Nouvelle partie |

## Utiliser le site chez soi

Le plus simple, c'est de lancer un petit serveur dans ce dossier :

```bash
python -m http.server 5540
```

Puis d'ouvrir http://localhost:5540. En ouvrant directement `index.html`, tout marche aussi, mais l'ordi réfléchit moins longtemps aux plus hauts niveaux : les navigateurs interdisent de réfléchir en arrière-plan depuis un simple fichier. La 3D a besoin d'Internet (pour charger Three.js).

## Comment c'est fait

Du HTML, du CSS et du JavaScript, sans framework et sans image. La 3D utilise Three.js r128, comme Pile ou Face.

- Le moteur n'utilise aucun hasard : rejouer la liste des coups redonne toujours la même partie. C'est ce qui permet d'annuler, de reprendre une partie et de l'analyser.
- Le bot cherche le meilleur coup avec l'élagage alpha-bêta, une table de transposition et l'approfondissement progressif, dans un Web Worker pour que les animations restent fluides. Pour 3 ou 4 joueurs, il considère que tous les autres jouent contre lui.
- Les sons sont générés avec la Web Audio API, sans fichier audio.

| Fichier | Contenu |
|---|---|
| `index.html` | La page du jeu |
| `regles.html`, `astuces.html` | Les règles et les astuces |
| `style.css` | Le style du site |
| `js/engine.js` | Les règles du jeu et tous les modes |
| `js/ai.js`, `js/ai-worker.js` | Le bot, l'indice et l'analyse |
| `js/board2d.js`, `js/board3d.js` | Les plateaux et leurs animations |
| `js/fx.js` | Particules, confettis, couleurs |
| `js/tournament.js` | Le tournoi et son tableau |
| `js/puzzles.js` | Les puzzles |
| `js/stats.js` | Les statistiques par joueur |
| `js/app.js` | Les réglages et le déroulement |
| `js/pages.js` | Les exemples des pages Règles et Astuces |
| `js/sound.js` | Les sons et les vibrations |
| `logo.svg` | Le logo Turbonix |
| `turbonix.css`, `STYLE-TURBONIX.md` | Le style commun des sites Turbonix |

---

Turbonix Entertainment
