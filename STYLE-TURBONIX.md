# Style Turbonix — Guide de l'interface

Ce guide décrit en détail l'interface du site **Pile ou Face**, pour refaire exactement le même style dans les autres mini-sites Turbonix Entertainment.

- **Fichier de style commun :** [`turbonix.css`](turbonix.css). Il contient tout ce qui est décrit ici, prêt à l'emploi.
- **Logo :** [`logo.svg`](logo.svg).
- **Site de référence :** https://turbonix-x.github.io/pile-ou-face/

> Règle d'or : **jaune pour l'action, mauve pour la sélection, noir/gris foncé pour le cadre, blanc pour le texte sur fond sombre.**

---

## Sommaire

1. [Démarrer un nouveau site](#1-démarrer-un-nouveau-site)
2. [Couleurs](#2-couleurs)
3. [Police et tailles de texte](#3-police-et-tailles-de-texte)
4. [Arrondis, espacements, ombres](#4-arrondis-espacements-ombres)
5. [Disposition de la page](#5-disposition-de-la-page)
6. [Header et boutons du haut](#6-header-et-boutons-du-haut)
7. [Logo](#7-logo)
8. [Boutons](#8-boutons)
9. [Autres composants](#9-autres-composants)
10. [Probabilités](#10-probabilités)
11. [Statistiques et historique](#11-statistiques-et-historique)
12. [Zone de jeu et effets](#12-zone-de-jeu-et-effets)
13. [Animations](#13-animations)
14. [Fenêtres, notifications, footer](#14-fenêtres-notifications-footer)
15. [Mode téléphone](#15-mode-téléphone)
16. [Sons, vibrations, sauvegarde, partage](#16-sons-vibrations-sauvegarde-partage)
17. [Correspondance avec le code de Pile ou Face](#17-correspondance-avec-le-code-de-pile-ou-face)
18. [Liste de vérification](#18-liste-de-vérification)

---

## 1. Démarrer un nouveau site

Copier `turbonix.css` et `logo.svg` dans le dossier du site, puis partir de ce squelette :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nom du site — Turbonix</title>
  <link rel="icon" href="logo.svg" type="image/svg+xml">
  <script>
    // Thème appliqué avant l'affichage (évite un flash blanc)
    (function () {
      var prefs = {};
      try { prefs = JSON.parse(localStorage.getItem("tx-prefs")) || {}; } catch (e) {}
      var theme = prefs.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="turbonix.css">
  <link rel="stylesheet" href="style.css"> <!-- styles propres au site -->
</head>
<body>
  <div class="bg-blobs" aria-hidden="true"><span></span><span></span><span></span></div>

  <header class="site-header">
    <div class="header-inner">
      <h1 class="site-title">Mot <span>mis</span> en avant</h1>
      <div class="header-right">
        <!-- boutons du haut, voir section 6 -->
        <a href="#" class="logo" aria-label="Turbonix Entertainment">
          <img src="logo.svg" alt="Logo Turbonix" width="44" height="44">
        </a>
      </div>
    </div>
  </header>

  <main class="container">
    <section class="card full">…zone principale…</section>
    <section class="card">…réglages…</section>
    <section class="card">…statistiques…</section>
  </main>

  <footer class="site-footer">
    <p><span id="year"></span> Turbonix Entertainment. Tous droits réservés.</p>
  </footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>
</html>
```

Dans le footer, l'année est remplie en JavaScript : `document.getElementById("year").textContent = new Date().getFullYear();`. **Il n'y a pas de symbole ©.**

---

## 2. Couleurs

### Couleurs de marque (identiques en clair et en sombre)

| Variable | Hex | Utilisation |
|---|---|---|
| `--yellow` | `#ffd60a` | Bouton principal, bordure du header, résultat surligné, sélecteur actif « Comparer », lueurs |
| `--yellow-light` | `#ffe45c` | Haut des dégradés jaunes |
| `--yellow-dark` | `#e6b800` | Jaune plus sombre (survol, bas des dégradés) |
| *(bas du bouton)* | `#f5c400` | Fin du dégradé du bouton principal |
| `--mauve` | `#9b6dff` | Sélection active, focus, interrupteurs, bordure du footer, contour du logo |
| `--mauve-light` | `#c9b0ff` | Fin du dégradé du mot mis en avant dans le titre |
| `--mauve-dark` | `#6f45d9` | Bas des dégradés mauves (pastilles actives, pilule) |
| `--mauve-deep` | `#2d1b57` | Pastilles numérotées, badge « A » |
| `--black` | `#0d0c12` | Base du header et du footer |
| `--ink` | `#15131c` | Texte sur fond jaune, bordure du bouton principal, fond des notifications |
| `--white` | `#ffffff` | Texte sur fond sombre ou mauve |

### Couleurs qui changent avec le thème

| Variable | Clair | Sombre | Rôle |
|---|---|---|---|
| `--bg` | `#f4f2fa` | `#08070c` | Fond de la page |
| `--surface` | `rgba(255,255,255,0.72)` | `rgba(22,20,31,0.72)` | Fond des cartes (verre dépoli) |
| `--surface-solid` | `#ffffff` | `#16141f` | Champs, fenêtres, boutons secondaires |
| `--surface-2` | `rgba(236,233,245,0.85)` | `rgba(38,34,52,0.8)` | Fond des lignes, pastilles, cases |
| `--text` | `#15131c` | `#f3f1f8` | Texte principal |
| `--muted` | `#6b6878` | `#a39fb3` | Texte secondaire, étiquettes |
| `--border` | `rgba(120,110,150,0.22)` | `rgba(155,109,255,0.18)` | Bordures fines |
| `--mauve-soft` | `rgba(155,109,255,0.14)` | `rgba(155,109,255,0.18)` | Fond mauve léger (survol, sélection, anneau de focus) |
| `--btn-shadow` | `#15131c` | `#9b6dff` | Ombre décalée du bouton principal |
| `--warn` | `#a87900` | `#ffd60a` | Avertissements (total ≠ 100 %) |
| `--error` | `#d6336c` | `#ff6b9a` | Erreurs |
| `--stage-bg` | dégradé `#3f3558 → #241d33 → #15111d` | dégradé `#2a1f45 → #140f22 → #0a0812` | Fond de la zone de jeu (toujours sombre) |

### Taches de couleur du fond animé

| Tache | Clair | Sombre |
|---|---|---|
| 1 (haut droite) | `rgba(255,214,10,0.35)` | `rgba(255,214,10,0.16)` |
| 2 (bas gauche) | `rgba(155,109,255,0.35)` | `rgba(155,109,255,0.30)` |
| 3 (centre) | `rgba(155,109,255,0.20)` | `rgba(111,69,217,0.25)` |

### Couleurs fixes (header, footer, divers)

| Élément | Couleur |
|---|---|
| Fond du header | `rgba(13,12,18,0.88)` + flou 14 px |
| Fond du footer | `rgba(13,12,18,0.92)` |
| Texte du footer | `#c9c6d6` |
| Texte des boutons du header | `#f3f1f8` ; éteint : `#8a879a` |
| Fond de l'interrupteur de thème | `#26222f` |
| Bouton danger | `#e8336f`, survol `#cc2259` |
| Survol danger (header) | bordure `#ff6b9a`, texte `#ff8fb3` |
| Historique (étiquette sombre) | `#1d1530` |

### Couleurs prêtes pour la personnalisation (7 + 7)

- **Corps du dé :** `#4a2d85` (mauve nuit), `#ffe766` (jaune), `#ffffff` (blanc), `#16141c` (noir), `#c1121f` (rouge), `#0f7b5f` (vert), `#1d4ed8` (bleu).
- **Chiffres et symboles :** `#ffd60a`, `#ffffff`, `#141414`, `#9b6dff`, `#ff4d6d`, `#2ee6a6`, `#38bdf8`.
- **Les trois objets comparés :** A = mauve nuit `#4a2d85` avec jaune `#ffd60a` ; B = jaune `#ffe766` avec noir `#141414` ; C = blanc `#ffffff` avec mauve `#6f45d9`.

---

## 3. Police et tailles de texte

**Police unique : [Outfit](https://fonts.google.com/specimen/Outfit)** (Google Fonts, graisses 400 à 900). Polices de secours : `"Segoe UI", system-ui, -apple-system, sans-serif`. Les codes et les champs de couleur hex utilisent `Consolas, "Courier New", monospace`.

| Élément | Taille | Graisse | Détails |
|---|---|---|---|
| Titre du site (header) | `1.6rem` (téléphone `1.15rem`) | 900 | `letter-spacing: -0.5px`, blanc ; le mot mis en avant est en dégradé mauve `#9b6dff → #c9b0ff` |
| Titre de carte `h2` | `1.3rem` | 800 | `letter-spacing: -0.3px`, précédé d'un losange 10 px jaune → mauve tourné à 45° |
| Sous-titre `h3` | `1rem` | 700 | marge `20px 0 10px` |
| Texte normal | `1rem` (16 px) | 400 | |
| Bouton principal | `1.2rem` | 800 | |
| Boutons normaux | `1rem` | 700 | |
| Petits boutons, pastilles | `0.85rem` / `0.88rem` | 700 | |
| Étiquettes de champ | `0.9rem` | 600 | précision entre parenthèses en `<small>` gris, graisse 400 |
| Résultat | `1.2rem` | 700 | valeur surlignée en jaune |
| Étiquette au-dessus du résultat | `0.75rem` | — | MAJUSCULES, `letter-spacing: 1.5px`, gris |
| Chiffre clé (stats) | `1.3rem` | 900 | |
| Étiquette de chiffre clé | `0.72rem` | — | MAJUSCULES, `letter-spacing: 0.8px` |
| Bannière « INCROYABLE ! » | `clamp(1.6rem, 5vw, 2.8rem)` | 900 | dégradé animé jaune → blanc → mauve |
| Petits textes (`.small`) | `0.85rem` | | |
| Astuces (`.hint`) | `0.8rem` | | centrées, grises |
| Erreurs, avertissements | `0.82rem` | | |

**Ton des textes :** en français, en tutoyant (« Clique sur Lancer », « Tu peux… »), avec des emojis sobres dans les boutons (🎲, 🔀, ⚖️, 🪙).

---

## 4. Arrondis, espacements, ombres

### Arrondis

| Élément | Arrondi |
|---|---|
| Cartes (`--radius`) | `20px` |
| Zone de jeu, fenêtres | `22px` |
| Boutons normaux et principal | `14px` |
| Lignes de probabilité, chiffres clés, encadrés d'aide | `14px` |
| Boutons du header, boutons-icônes, onglets, champs | `12px` |
| Petits boutons, champs dans les lignes, aperçu de couleur | `10px` |
| Historique, résultat surligné, badges | `8px` |
| Pastilles, interrupteurs, pilule | `999px` (pilule) |
| Pastilles de couleur | `50%` (rond) |
| Logo | `rx="15"` sur 64 (environ 23 %) |

### Espacements

| Élément | Valeur |
|---|---|
| Largeur maximale du contenu | `1240px`, centré |
| Marges intérieures de la page | `28px 20px 48px` (téléphone `18px 16px 30px`) |
| Espace entre les cartes | `22px` |
| Marge intérieure d'une carte | `24px` (téléphone `18px 14px`) |
| Header | `12px 20px` (téléphone `10px 12px`) |
| Espace entre boutons du header | `8px` (téléphone `5px`) |
| Bouton principal | `12px 26px`, largeur minimale `240px` |
| Petit bouton | `7px 13px` |
| Pastille | `6px 13px` |

### Ombres

| Élément | Ombre |
|---|---|
| Cartes (clair) | `0 10px 40px rgba(60,40,120,0.12)` |
| Cartes (sombre) | `0 10px 40px rgba(0,0,0,0.5)` |
| Header | `0 4px 30px rgba(255,214,10,0.12)` (lueur jaune) |
| Footer | `0 -4px 30px rgba(155,109,255,0.15)` (lueur mauve) |
| Bouton principal | `4px 4px 0 var(--btn-shadow), 0 0 30px rgba(255,214,10,0.35)` ; survol `6px 6px 0 …, 0 0 40px …0.5` ; appui `1px 1px 0 …` |
| Pastille active | `0 4px 14px rgba(155,109,255,0.4)` |
| Pilule mauve | `0 4px 16px rgba(155,109,255,0.45)` |
| Anneau de focus | `0 0 0 4px var(--mauve-soft)` + bordure mauve |
| Résultat surligné | `0 4px 18px rgba(255,214,10,0.35)` |
| Fenêtres | `0 30px 80px rgba(0,0,0,0.45)` |
| Notification | `0 10px 40px rgba(155,109,255,0.35)` |
| Barres de stats | `0 0 10px rgba(155,109,255,0.4)` |
| Pastilles de couleur | `inset 0 -4px 8px rgba(0,0,0,0.25)` (effet bombé) |

**Effet verre :** cartes et header ont `backdrop-filter: blur(18px)` (header `14px`) sur un fond semi-transparent. C'est ce qui laisse voir les taches de couleur du fond à travers.

---

## 5. Disposition de la page

```
┌──────────────────────────────────────────────────────────┐
│ HEADER collant, noir vitré, bordure jaune 3 px en bas    │
│ Titre (gauche)            🔊 📳 🔗 🗑  [☀/🌙]  [Logo X]  │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ CARTE PRINCIPALE (pleine largeur)                  │  │
│  │ sélecteur Pièce/Dé · zone de jeu sombre · résultat │  │
│  │ réglages rapides · [ BOUTON JAUNE ] [ secondaire ] │  │
│  │ astuce · 10 derniers lancers                       │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ PERSONNALISATION (pleine largeur)                  │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────┐ ┌───────────────────────┐  │
│  │ RÉGLAGES (1,15 part)     │ │ STATISTIQUES (1 part) │  │
│  └──────────────────────────┘ └───────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ FOOTER noir, bordure mauve 3 px en haut, texte centré    │
└──────────────────────────────────────────────────────────┘
```

- **Grille :** `grid-template-columns: 1.15fr 1fr`, espace `22px`, `align-items: start`. Les cartes `.full` prennent toute la largeur.
- **Sous 900 px :** une seule colonne, les cartes s'empilent.
- **Ordre dans une carte :** titre `h2` à gauche avec l'action secondaire à droite (`.card-head`), puis le contenu. Les sous-parties sont séparées par une ligne pointillée (`border-top: 1px dashed var(--border)`).
- **Apparition :** les cartes montent de 18 px en apparaissant, l'une après l'autre (décalage de 0,08 s).

---

## 6. Header et boutons du haut

Le header est **collant** (`position: sticky; top: 0`), noir vitré, avec une **bordure jaune de 3 px** et une lueur jaune.

**À gauche :** le titre du site en blanc, graisse 900, avec un mot clé en dégradé mauve (ex. Pile **ou** Face).

**À droite, dans cet ordre :**

| Bouton | Rôle | Comportement |
|---|---|---|
| 🔊 Son | Couper ou rétablir les sons | Deux icônes `on`/`off` ; la classe `.off` sur le bouton grise l'icône |
| 📳 Vibrations | Couper ou rétablir les vibrations | Idem ; la bulle d'aide précise « sur téléphone uniquement » si l'appareil ne vibre pas |
| 🔗 Partager | Ouvre la fenêtre « Partager & sauvegarder » | |
| 🗑 Effacer | Efface la sauvegarde | Classe `.danger` (survol rose) ; **toujours une fenêtre de confirmation** : « Est-ce que vous voulez vraiment tout effacer ? » |
| ☀️/🌙 Thème | Clair ou sombre | Interrupteur 64 × 34 px ; la bille jaune passe à droite et devient mauve en mode sombre (effet ressort) |
| Logo | Lien vers l'accueil | Tourne de −10° et grossit de 10 % au survol |

Les boutons `.hbtn` font **38 × 38 px**, arrondi 12 px, bordure blanche à 14 %, fond blanc à 6 %. Au survol : bordure mauve, fond mauve à 20 %, montent de 2 px. À l'appui, ils rétrécissent à 92 %.

### Icônes (SVG, traits de 2 px, `viewBox="0 0 24 24"`)

```html
<!-- Son (deux états) -->
<button class="hbtn" aria-pressed="true" title="Sons activés" aria-label="Activer ou couper les sons">
  <svg class="on" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
  <svg class="off" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>
</button>

<!-- Vibrations (deux états) -->
<button class="hbtn" aria-pressed="true" title="Vibrations activées" aria-label="Activer ou couper les vibrations">
  <svg class="on" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8"/><path d="M21 8v8"/></svg>
  <svg class="off" viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 3l18 18"/></svg>
</button>

<!-- Partager -->
<button class="hbtn" title="Partager / sauvegarder" aria-label="Partager la configuration">
  <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>
</button>

<!-- Effacer -->
<button class="hbtn danger" title="Effacer la sauvegarde" aria-label="Effacer la sauvegarde">
  <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
</button>

<!-- Thème -->
<button class="theme-toggle" aria-label="Changer de thème" title="Mode sombre / clair">
  <span class="theme-icon sun">☀️</span>
  <span class="theme-icon moon">🌙</span>
</button>
```

### JavaScript du thème

```js
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    const prefs = JSON.parse(localStorage.getItem("tx-prefs")) || {};
    prefs.theme = theme;
    localStorage.setItem("tx-prefs", JSON.stringify(prefs));
  } catch (e) { /* stockage indisponible */ }
});
```

---

## 7. Logo

Fichier : [`logo.svg`](logo.svg) (carré 64 × 64, vectoriel, net à toutes les tailles). Il sert aussi d'icône d'onglet (`<link rel="icon" href="logo.svg" type="image/svg+xml">`).

**Description :**
- **Fond :** carré arrondi (`rx="15"`), **gris foncé** en dégradé vertical `#3a3740` (haut) → `#1c1a21` (bas), avec un reflet blanc à 6 % sur le haut.
- **Contour :** trait de 4 px **mauve** en dégradé diagonal `#c4a8ff` → `#9b6dff` → `#6f45d9`.
- **X :** deux barres **jaunes** biseautées qui se croisent, en dégradé vertical `#fff6a8` → `#ffd60a` → `#d99a00`, avec un léger halo (flou 1,6). La barre qui va du haut-droite au bas-gauche passe au-dessus, séparée par un trait `#1c1a21` de 1,6 px.
- **Brillance :** un reflet blanc dégradé en haut de chaque barre, et une petite étincelle blanche à 4 branches en haut à droite.
- **Taille dans le header :** 44 × 44 px (34 × 34 sur téléphone).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3740"/>
      <stop offset="1" stop-color="#1c1a21"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c4a8ff"/>
      <stop offset="0.5" stop-color="#9b6dff"/>
      <stop offset="1" stop-color="#6f45d9"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6a8"/>
      <stop offset="0.45" stop-color="#ffd60a"/>
      <stop offset="1" stop-color="#d99a00"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="3" y="3" width="58" height="58" rx="15" fill="url(#bg)" stroke="url(#rim)" stroke-width="4"/>
  <path d="M8 18 Q8 7 19 7 H45 Q56 7 56 18 Q32 26 8 18 Z" fill="#ffffff" opacity="0.06"/>
  <g filter="url(#glow)">
    <path d="M14 15 H24 L50 49 H40 Z" fill="url(#gold)"/>
    <path d="M40 15 H50 L24 49 H14 Z" fill="url(#gold)" stroke="#1c1a21" stroke-width="1.6" paint-order="stroke"/>
  </g>
  <path d="M15.5 16 H23 L27 21.2 H20 Z" fill="url(#shine)"/>
  <path d="M41.5 16 H49 L45 21.2 H37.6 Z" fill="url(#shine)"/>
  <path d="M50 9 L51 12 L54 13 L51 14 L50 17 L49 14 L46 13 L49 12 Z" fill="#ffffff" opacity="0.9"/>
</svg>
```

**Variante sur une pièce (« Pièce Turbonix ») :** fond noir `#3a3346 → #141119 → #050407`, rebord jaune `#ffd60a`, fin anneau mauve `#9b6dff`, grand X avec une barre mauve (`#6f45d9 / #c4a8ff`) et une barre jaune (`#e6b800 / #fff07a`), et le mot PILE ou FACE en blanc, graisse 900, sous le X.

---

## 8. Boutons

| Classe | Apparence | Utilisation |
|---|---|---|
| `.btn .btn-primary` | **Jaune** (dégradé `#ffe45c → #ffd60a → #f5c400`), bordure `#15131c` 2 px, ombre décalée de 4 px (noire en clair, **mauve** en sombre), halo jaune, **reflet blanc qui traverse le bouton toutes les 3,5 s** | **Une seule action principale par page** (Lancer, Valider…) |
| `.btn .btn-ghost` | Fond de carte, bordure couleur du texte ; survol mauve léger | Action secondaire à côté du bouton principal (🔀 Tout au hasard) |
| `.btn .btn-small` | Plus petit (`7px 13px`, `0.85rem`, bordure 1,5 px, arrondi 10 px) ; survol mauve | Outils (⚖️ Égaliser, Appliquer, Réinitialiser) |
| `.btn .btn-danger` | Rose `#e8336f`, texte blanc | Confirmation d'effacement |
| `.icon-btn` | Carré 44 px avec un emoji ; tourne de −20° au survol et fait un tour (200°) à l'appui | 🎲 « valeur au hasard » à côté d'un champ |
| `.hbtn` | Bouton-icône du header (section 6) | |

**Comportement commun :** monte de 2 px au survol, descend de 2 px et rétrécit à 98 % à l'appui, avec un effet ressort (`--spring`). Un bouton désactivé passe à 55 % d'opacité, avec le curseur « interdit ».

**Pendant une action** (ajouter `busy` sur `<body>`), le bouton principal **pulse** (halo jaune qui grossit toutes les 0,9 s) et il est désactivé. **Il doit toujours être réactivé à la fin, même en cas d'erreur** (`try { … } finally { … }`).

**Libellé dynamique :** le bouton principal dit ce qu'il va faire (« Lancer la pièce », « Lancer le dé ×50 », « Tout lancer »).

---

## 9. Autres composants

| Composant | Classe | Description |
|---|---|---|
| Pastilles | `.presets` + `.chip` (+ `.active`) | Pilules grises ; l'active est en dégradé mauve `#9b6dff → #6f45d9`, texte blanc, lueur mauve. Montent de 2 px au survol. |
| Choix à 2 options | `.pill-switch` + `.pill-indicator` | Pilule de 240 px ; une capsule mauve **glisse** sous l'option choisie (0,5 s, ressort). `data-active="1"` pour la 2e option. |
| Petit sélecteur chiffré | `.seg` + `.seg-indicator` | 3 cases de 40 px ; indicateur **jaune** lumineux qui glisse ; `data-active="0/1/2"`. |
| Onglets | `.tabs` + `.tab` (+ `.active`) | Badge lettre + libellé ; l'actif a une bordure mauve et un fond mauve léger. |
| Badges | `.badge`, `.badge.b`, `.badge.c` | Carrés 26 px : A = fond `#2d1b57` / texte jaune, B = jaune / noir, C = blanc / mauve. |
| Interrupteur | `.switch` + `.switch-track` + `.switch-thumb` | 48 × 28 px, gris, mauve lumineux une fois activé, la bille glisse avec un ressort. |
| Curseur | `.range` avec `style="--fill: 40%"` | Rail de 8 px rempli d'un dégradé mauve → jaune, bille blanche à bord mauve de 3 px. |
| Champ | `.field` + `label` + `.field-row` + `input` | Champ de 180 px, fond `--surface-2`, arrondi 12 px, texte en gras ; au focus, bordure mauve + anneau mauve de 4 px. |
| Encadré d'info | `.info` (mauve) / `.info.alt` (jaune) | Barre de 4 px à gauche, fond léger, texte `0.88rem` ; commence par un emoji (⚖️, ✍️). |
| Aide repliable | `<details class="help"><summary>…</summary><ul>…</ul></details>` | Titre mauve cliquable, liste en `0.88rem`. |
| Couleurs | `.swatches` + `.swatch` (`style="--c:#hex"`) | Ronds de 30 px bombés ; l'actif a une bordure mauve et grossit de 10 %. |

### Choix de couleur (7 + recherche + 7 récentes)

1. **7 couleurs prêtes** en pastilles.
2. **Une ligne de recherche :** aperçu carré, champ texte en police à chasse fixe (« #ff8800, orange, rouge… ») et bouton 🎨 qui ouvre la palette du système. On accepte les codes hex (`#f80`, `ff8800`), les noms anglais du navigateur et une liste de noms français (rouge, bleu, vert, jaune, noir, blanc, gris, orange, violet, mauve, rose, marron, turquoise, or, argent, cyan, bordeaux, beige). La couleur s'applique dès qu'elle est reconnue ; un message s'affiche si elle est inconnue.
3. **7 couleurs récentes :** les dernières couleurs personnalisées utilisées (pas les 7 prêtes), mémorisées sur l'appareil.

```js
// Transforme "#f80", "ff8800", "orange"… en "#rrggbb" (ou null si inconnue)
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
```

---

## 10. Probabilités

C'est le cœur de Pile ou Face, et il se réutilise pour tout tirage au sort (roue, tombola, cartes…).

### Interface

```
Faces & probabilités                     [● Équilibre automatique]
┌ ⚖️ Équilibre automatique activé : … (encadré mauve) ──────────┐
Pour chaque face : 25 ou 25%, 1/4 (fraction), 1:3 (1 chance contre 3).
Ratio  [ 3:1                                      ] [Appliquer]
[⚖️ Égaliser] [🎲 Probabilités aléatoires] [Ramener à 100 %]
┌──────────────────────────────────────────────────────────────┐
│ [1] [ Pile                         ] [          75 %]        │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━         │
│ [2] [ Face                         ] [= 25 %    1/4]         │
│     ━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
└──────────────────────────────────────────────────────────────┘
‹ Faces 1–50 sur 100 ›                       Aller à la face [  ]
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Total : 100 %
```

- **Une ligne par choix** (`.prob-row`) : numéro (pastille dégradé `#2d1b57 → #15131c`, chiffre jaune), nom modifiable, pourcentage, et curseur sur toute la largeur en dessous.
- **Plus de 50 choix :** pagination de 50 par page, avec « Aller à la face n° » (la ligne visée clignote en mauve).
- **Total en bas :** passe en couleur d'avertissement s'il est différent de 100 %, avec l'explication « les valeurs sont utilisées en proportion ».

### Les deux modes

| Mode | Règle |
|---|---|
| **Équilibre automatique** (activé par défaut) | Le total reste **toujours à 100 %**. Quand on change une valeur, **toutes les autres s'ajustent en proportion**. Si les autres sont toutes à 0, le reste est partagé à parts égales. |
| **Libre** | Chaque valeur est indépendante. Si le total n'est pas 100 %, les valeurs sont utilisées en proportion. Le bouton « Ramener à 100 % » les remet à l'échelle. |

Réactiver l'équilibre ramène les valeurs à 100 % en gardant leurs proportions.

### Formats acceptés dans chaque case

| Saisie | Signification | Résultat |
|---|---|---|
| `25` ou `25%` | pourcentage | 25 % |
| `1/4` | fraction | 25 % |
| `1:3` | ratio « 1 chance contre 3 » | 25 % |

Quand on tape une fraction ou un ratio, le texte tapé reste affiché et l'équivalent apparaît en petit, en mauve, à gauche (« = 25 % »).

### Champ « Ratio »

Il se **met à jour tout seul** et montre la répartition sous sa forme la plus simple (75 % / 25 % → `3:1`, 1/3 et 2/3 → `1:2`). On peut aussi y taper un ratio (`3:2:1`) et l'appliquer ; il faut exactement une valeur par choix.

### Code de référence

```js
// "25", "25%", "1/4", "1:3" → pourcentage (NaN si invalide)
function parseProb(text) {
  const s = text.trim().replace(/,/g, ".").replace(/\s+/g, "");
  let m;
  if ((m = s.match(/^(\d*\.?\d+)%?$/))) return Math.min(100, Number(m[1]));
  if ((m = s.match(/^(\d*\.?\d+)\/(\d*\.?\d+)$/))) {
    const b = Number(m[2]);
    return b > 0 ? Math.min(100, (Number(m[1]) / b) * 100) : NaN;
  }
  if ((m = s.match(/^(\d*\.?\d+):(\d*\.?\d+)$/))) {
    const a = Number(m[1]), b = Number(m[2]);
    return a + b > 0 ? (a / (a + b)) * 100 : NaN;
  }
  return NaN;
}

// Équilibre automatique : on fixe la valeur i, les autres s'ajustent en proportion
function setWeight(weights, i, value, balanced) {
  const v = Math.max(0, Math.min(100, value));
  if (balanced) {
    const others = weights.reduce((a, b) => a + b, 0) - weights[i];
    const rest = 100 - v;
    weights.forEach((w, j) => {
      if (j !== i) weights[j] = others > 1e-9 ? (w * rest) / others : rest / (weights.length - 1);
    });
  }
  weights[i] = v;
}

// Ratio le plus simple : [75, 25] → "3:1"
function ratioText(w) {
  const min = Math.min(...w.filter((x) => x > 1e-9));
  for (let k = 1; k <= 12; k++) {
    const vals = w.map((x) => (x / min) * k);
    if (Math.max(...vals) <= 1000 && vals.every((v) => Math.abs(v - Math.round(v)) < 0.02)) {
      return vals.map(Math.round).join(":");
    }
  }
  return w.map((x) => Math.round(x * 100) / 100).join(":");
}

// Tirage pondéré, rapide même pour 1 000 000 de tirages (probabilités cumulées + dichotomie)
function makePicker(weights) {
  const cdf = [];
  weights.reduce((acc, w, i) => (cdf[i] = acc + w), 0);
  const total = cdf[cdf.length - 1];
  return () => {
    if (total <= 0) return Math.floor(Math.random() * weights.length);
    const r = Math.random() * total;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] > r) hi = mid; else lo = mid + 1; }
    return lo;
  };
}

// Probabilités aléatoires (toutes les répartitions ont la même chance)
function randomWeights(n) {
  const raw = Array.from({ length: n }, () => -Math.log(1 - Math.random()));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (v / sum) * 100);
}
```

Dans Pile ou Face, le hasard vient de `crypto.getRandomValues` (lu par paquets de 4 096 nombres) plutôt que de `Math.random`.

### Valeurs « au hasard » (🎲)

Les nombres aléatoires (nombre de faces, de lancers) suivent une **répartition logarithmique**, pour tomber aussi souvent sur des petits que sur des grands nombres :

```js
const randomLogInt = (min, max) => Math.round(Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min))));
```

---

## 11. Statistiques et historique

### Chiffres clés (`.kpis`)

4 cases (2 sur téléphone) : **Lancers**, **Dernier**, **Série en cours** (ex. « Face ×3 ») et **Écart moyen** (en points de %). Le chiffre est en `1.3rem`/900, l'étiquette en petites majuscules grises.

### Barres (`.bars`)

Une barre par choix :
- **partie remplie** (dégradé mauve → jaune) = pourcentage **obtenu** ;
- **trait vertical** (couleur du texte) = pourcentage **visé** ;
- au-dessus : « Nom — 26 » à gauche et « 52 % (visé 50 %) » à droite.

Au-delà de 20 choix, on n'affiche que les 12 plus sortis. L'échelle s'adapte à la plus grande valeur, pour que les barres restent visibles.

### Aide « Comment lire ces statistiques ? »

Un bloc repliable (`.help`) explique chaque chiffre, y compris la **loi des grands nombres** (l'écart moyen se rapproche de 0 quand on lance beaucoup).

### 10 derniers lancers (`.recent-list`)

Sous le bouton principal, dans la carte principale :
- grille de petites cartes (`minmax(190px, 1fr)`, une colonne sur téléphone) ;
- chaque carte : `[badge A/B/C si comparaison]  D20  →  **17**   sur 100` ;
- **la plus récente est bordée de jaune** avec une lueur ;
- 10 au maximum, sauvegardées ; un événement rare (tranche, coin) n'y figure pas.

```html
<ol class="recent-list">
  <li class="recent-item">
    <span class="recent-obj">D20</span><span class="recent-arrow">→</span><strong>17</strong><small class="muted">sur 100</small>
  </li>
</ol>
```

### Historique détaillé (`.history`)

Dans la carte Statistiques : les 60 derniers résultats en petites étiquettes, **noir/jaune** et **mauve/blanc** en alternance, avec un défilement au-delà de 150 px de haut.

### Comparaison

Un tableau (`.compare-table`) avec une ligne par objet : badge, objet, lancers, résultat le plus sorti, écart moyen. Cliquer sur une ligne sélectionne cet objet.

---

## 12. Zone de jeu et effets

- **Zone de jeu** (`.stage-zone`) : 320 px de haut (260 sur téléphone), arrondi 22 px, **toujours sombre** (`--stage-bg`), avec un **halo conique jaune/mauve qui tourne** en 14 s (2,5 s avec la classe `.rolling`).
- **À l'arrivée d'un résultat** (classe `.landed`) : flash jaune sur le bord, onde de choc jaune qui s'agrandit (×7 en 0,9 s) et explosion de 26 particules.
- **Événement rare** (classe `.jackpot` + `.banner`) : la zone clignote en doré 3 fois, la bannière « INCROYABLE ! » arrive en tournant avec un effet de brillance, et 4 salves de 40 particules avec des étoiles sont lancées.
- **Résultat** (`.result`) : petite étiquette grise en majuscules (« RÉSULTAT ») puis la valeur **surlignée en jaune**, qui apparaît avec un léger rebond.

```js
// Explosion de particules dans une zone (big = feu d'artifice avec étoiles)
function burst(zone, amount = 26, big = false) {
  const colors = ["#ffd60a", "#9b6dff", "#ffffff", "#ffe766", "#c4a8ff"];
  for (let k = 0; k < amount; k++) {
    const p = document.createElement("span");
    p.className = big && k % 3 === 0 ? "particle star" : "particle";
    p.style.background = p.style.color = colors[k % colors.length];
    const size = (big ? 6 : 4) + Math.random() * (big ? 10 : 7);
    p.style.width = p.style.height = size + "px";
    if (big) { p.style.left = 20 + Math.random() * 60 + "%"; p.style.top = 25 + Math.random() * 50 + "%"; }
    zone.appendChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = (big ? 90 : 70) + Math.random() * (big ? 160 : 110);
    p.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => p.remove();
  }
}
```

**La 3D de Pile ou Face** (pièces et dés) utilise Three.js r128 (`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`), avec un tapis de jeu en feutrine sombre, des anneaux jaune/mauve et un X en filigrane. Le code est dans `js/dice3d.js` ; il n'est pas dans `turbonix.css`.

---

## 13. Animations

### Courbes

| Variable | Valeur | Effet | Utilisation |
|---|---|---|---|
| `--ease` | `cubic-bezier(0.22, 0.8, 0.3, 1)` | Démarrage vif, arrivée très douce | Apparitions, couleurs, barres |
| `--spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Dépasse un peu puis revient (ressort) | Boutons, interrupteurs, pastilles, fenêtres |

### Liste

| Animation | Durée | Où |
|---|---|---|
| `tx-rise` : monte de 18 px en apparaissant | 0,7 s (cartes), 0,35 s (lignes, historique) | Cartes (décalées de 0,08 s), lignes de probabilité, historique |
| `tx-drift` : taches du fond qui dérivent | 22 à 32 s, aller-retour infini | Fond animé |
| `tx-shine` : reflet blanc qui traverse | 3,5 s en boucle | Bouton principal |
| `tx-pulse` : halo jaune qui grossit | 0,9 s en boucle | Bouton principal pendant une action |
| `tx-reveal` : apparaît en remontant (échelle 0,92 → 1) | 0,55 s, ressort | Résultat |
| `tx-pop` : fenêtre qui s'ouvre (échelle 0,9 → 1) | 0,4 s, ressort | Fenêtres |
| `tx-spin` : halo conique qui tourne | 14 s (2,5 s pendant une action) | Zone de jeu |
| `tx-shockwave` : anneau jaune qui s'agrandit | 0,9 s | Arrivée d'un résultat |
| `tx-flash` : surbrillance mauve | 1,2 s | Ligne atteinte avec « Aller à » |
| `tx-shake` : petit tremblement | 0,3 s | Saisie invalide |
| `tx-jackpot` + `tx-banner` + `tx-shimmer` | 1,2 s ×3 / 3,6 s / 1,2 s en boucle | Événement rare |
| Pilule et indicateurs qui glissent | 0,45 à 0,5 s, ressort | `.pill-switch`, `.seg`, interrupteurs |
| Changement de thème | 0,5 s | Fond, cartes, texte |

**Accessibilité :** si le système demande de réduire les animations (`prefers-reduced-motion`), elles sont toutes coupées.

---

## 14. Fenêtres, notifications, footer

- **Fenêtres** (`<dialog class="dialog">`) : 560 px de large (440 avec `.small`), arrondi 22 px, fond plein, ombre forte. Le fond derrière est assombri et flouté (6 px). Une croix ✕ en haut à droite, et les boutons d'action alignés à droite. Ouvrir avec `dialog.showModal()`.
- **Confirmation avant toute action définitive**, en vouvoyant dans la question : « Est-ce que vous voulez vraiment tout effacer ? », avec les boutons `Annuler` (petit) et `Oui, tout effacer` (`.btn-danger`).
- **Notifications** (`.toast`) : en bas au centre, fond `#15131c`, bordure mauve, lueur mauve ; elles montent avec un ressort et disparaissent après 2,6 s. Messages courts avec un emoji (« Lien copié ! 🔗 »).

```js
let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
```

- **Footer** : noir `rgba(13,12,18,0.92)`, **bordure mauve de 3 px en haut**, lueur mauve, texte `#c9c6d6` centré en `0.9rem` : « 2026 Turbonix Entertainment. Tous droits réservés. » (année automatique, **sans ©**).

---

## 15. Mode téléphone

| Largeur | Changements |
|---|---|
| **≥ 900 px** (PC, tablette en paysage) | 2 colonnes ; les fonctions « grand écran » (ex. comparer 2 ou 3 objets) sont visibles |
| **< 900 px** | **1 colonne** ; marges `18px 16px 30px` ; les éléments `.desktop-only` sont cachés (le site revient alors à un seul objet) |
| **≤ 560 px** (téléphone) | Titre `1.15rem` · header `10px 12px` · boutons du haut 32 px (icônes 16 px) · interrupteur de thème 52 × 30 · logo 34 px · cartes `18px 14px` · zone de jeu 260 px · **bouton principal et actions en pleine largeur** · chiffres clés sur 2 colonnes · « 10 derniers » sur 1 colonne · case % des lignes de probabilité à 104 px |
| **≤ 400 px** | Les icônes ☀️/🌙 de l'interrupteur disparaissent · boutons du haut 30 px |

**Tactile :**
- La zone 3D a `touch-action: none` : glisser dessus fait tourner l'objet au lieu de faire défiler la page.
- Un tap lance ; un glissé rapide vers le haut lance plus fort.
- Aucun élément ne doit déborder horizontalement : vérifier que `document.documentElement.scrollWidth === innerWidth` à 375 px.

---

## 16. Sons, vibrations, sauvegarde, partage

- **Sons** générés en direct (Web Audio, aucun fichier) : clic doux pour les réglages, « whoosh » pendant le vol, tintement métallique pour les pièces, choc pour les dés, petite mélodie de 3 notes (do, mi, sol aigus) au résultat, fanfare pour un événement rare. Code : `js/sound.js`.
- **Vibrations** (`navigator.vibrate`) : courtes à l'impact (10 à 35 ms), motif `[20, 40, 30]` au résultat, motif long `[60, 40, 60, 40, 200]` pour un événement rare.
- **Les deux se coupent** depuis le header ; le choix est mémorisé.
- **Raccourci clavier :** **Espace** lance partout, sauf quand on écrit dans un champ ou qu'une fenêtre est ouverte. La page ne défile pas, et rien ne se passe si une animation est déjà en cours.
- **Sauvegarde automatique** dans le navigateur (`localStorage`) 300 ms après chaque changement, avec un **numéro de version** pour pouvoir convertir les anciennes sauvegardes. Les préférences (thème, son, vibrations, couleurs récentes) sont séparées des données.
- **Fichier de sauvegarde :** export et import `.json` depuis la fenêtre Partager.
- **Lien de partage :** la configuration est compressée (`CompressionStream("deflate-raw")`), encodée en base64 adaptée aux URL et placée après `#c=`. Un lien fait environ 80 caractères. À l'ouverture du lien, la configuration est chargée, une notification s'affiche, puis le `#c=…` est retiré de l'adresse.

---

## 17. Correspondance avec le code de Pile ou Face

`turbonix.css` reprend le style de `style.css`, avec des noms de classes plus généraux :

| Pile ou Face (`style.css`) | `turbonix.css` |
|---|---|
| `.stage`, `.look` (pleine largeur) | `.full` |
| `.mode-switch`, `.mode-indicator`, `.mode-btn` | `.pill-switch`, `.pill-indicator`, `button` |
| `.seg[data-count="2"]` | `.seg[data-active="1"]` |
| `.slot-tabs`, `.slot-tab` | `.tabs`, `.tab` |
| `.slot-badge`, `.slot-b`, `.slot-c` | `.badge`, `.badge.b`, `.badge.c` |
| `.faces-list`, `.face-row`, `.face-index`, `.name` | `.prob-list`, `.prob-row`, `.prob-index`, `.prob-name` |
| `.pct-wrap`, `.pct-range` | `.prob-pct`, `.range .prob-range` |
| `.total-row` | `.prob-total` |
| `.info.off` | `.info.alt` |
| `.arena`, `.edge-win`, `.edge-banner` | `.stage-zone`, `.jackpot`, `.banner` |
| `.edge-title`, `.result-last` | `.jackpot-title`, `.result .line` |
| `.stats-bars`, `.stat-row`, `.stat-label` | `.bars`, `.bar-row`, `.bar-label` |
| `.launch-actions` | `.actions` |
| `.small-dialog` | `.dialog.small` |
| `body.rolling` | `body.busy` |
| `.recent` (séparateur) | `.divider` |
| `--arena` | `--stage-bg` |
| Animations `rise`, `shine`… | `tx-rise`, `tx-shine`… (préfixe `tx-` pour éviter les conflits) |

---

## 18. Liste de vérification

Avant de publier un nouveau site Turbonix :

- [ ] `turbonix.css`, la police Outfit et `logo.svg` sont chargés (logo en haut à droite et en icône d'onglet).
- [ ] Le header est noir vitré avec une bordure jaune, et le titre a un mot en dégradé mauve.
- [ ] Les boutons du haut sont dans l'ordre son, vibrations, partager, effacer (avec confirmation), thème, logo.
- [ ] Le thème clair/sombre marche, sans flash au chargement, et le choix est mémorisé.
- [ ] Il y a **un seul** bouton principal jaune, et il se réactive toujours après une action.
- [ ] Les cartes sont en verre dépoli, ont un titre avec le losange et apparaissent en montant.
- [ ] La page est testée à 375 px : une colonne, bouton en pleine largeur, pas de défilement horizontal.
- [ ] Les animations sont coupées si le système le demande.
- [ ] Le footer affiche « *année* Turbonix Entertainment. Tous droits réservés. », sans ©.
- [ ] Les textes sont en français, en tutoyant, avec quelques emojis.
