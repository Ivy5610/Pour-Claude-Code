# Between Us 💌

A small virtual card game for getting to know your date, one question at a time.

## Play

Open `index.html` in a browser. There is nothing to install.

To play on a phone, the easiest way is to turn on **GitHub Pages**
(Settings → Pages → choose the branch, folder `/ (root)`), then on the phone use "Add to Home Screen".

To try it locally: `python3 -m http.server`, then open http://localhost:8000

## Decks

| Deck | Contents |
| --- | --- |
| ☕ Part 1 · Breaking the ice | Arthur Aron's 36 questions (1–12) |
| 🔮 Part 2 · Opening up | The 36 questions (13–24) |
| 🕯️ Part 3 · Getting closer | The 36 questions (25–36), then four minutes of eye contact |
| 🌙 You & Me | Questions for getting to know each other better |
| 🔥 Under the Covers | Gentle intimate questions (asks for confirmation first) |
| 🎲 Mini-Games | Little games to laugh and get closer |

## How it works

- Pick one or more decks. Cards are in order, or shuffled if you turn that on.
- Tap a card to flip it, then swipe it (or press →) to move to the next one.
- The person who answers first alternates with each card.
- Each player has 3 jokers to skip a question, no explanation needed.
- ♡ saves a card to your favorites so you can play it again another night.
- The game is saved on the device, so you can pick it up later.

## Privacy

Names, favorites and game progress are stored only in the browser on your device.
Nothing is sent anywhere: there is no server, no account and no analytics.

## Editing the questions

All cards are in `js/decks.js`. To add one, add a line `{ text: "…" }`.
For a mini-game, use `type: "game"`. For a card with a timer, use `type: "timer", seconds: 60`.
