# Entre nous 💌

Un petit jeu de cartes virtuel pour apprendre à connaître son date, une question à la fois.

## Jouer

Ouvre `index.html` dans un navigateur. Il n'y a rien à installer.

Pour y jouer sur téléphone, le plus simple est d'activer **GitHub Pages**
(Settings → Pages → Branch `main`, dossier `/root`). Ensuite, sur le téléphone : « Ajouter à l'écran d'accueil ».

Pour tester en local : `python3 -m http.server` puis http://localhost:8000

## Les paquets

| Paquet | Contenu |
| --- | --- |
| ☕ Partie 1 · Briser la glace | Les 36 questions d'Arthur Aron (1 à 12) |
| 🔮 Partie 2 · Se dévoiler | Les 36 questions (13 à 24) |
| 🕯️ Partie 3 · Se rapprocher | Les 36 questions (25 à 36), puis 4 minutes de regard |
| 🌙 Toi & moi | Des questions pour mieux se connaître |
| 🔥 Sous la couette | Des questions intimes, tout en douceur (demande une confirmation) |
| 🎲 Mini-jeux | Des petits jeux pour rire et se rapprocher |

## Fonctionnement

- Choisis un ou plusieurs paquets. Les cartes sont dans l'ordre, ou mélangées si tu actives l'option.
- Touche une carte pour la retourner, puis glisse-la (ou appuie sur →) pour passer à la suivante.
- La personne qui commence change à chaque carte.
- Chacun a 3 jokers pour passer une question sans se justifier.
- ♡ garde une carte dans vos « coups de cœur », pour la rejouer un autre soir.
- La partie est sauvegardée sur l'appareil : tu peux la reprendre plus tard.

## Modifier les questions

Toutes les cartes sont dans `js/decks.js`. Pour en ajouter une, ajoute une ligne `{ text: "…" }`.
Pour un petit jeu, mets `type: "jeu"`. Pour une carte avec chrono, mets `type: "minuteur", seconds: 60`.
