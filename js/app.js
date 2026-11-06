(() => {
  "use strict";

  // ---------- constants & helpers ----------
  const DECKS = window.DECKS;
  const deckById = Object.fromEntries(DECKS.map((d) => [d.id, d]));
  const JOKERS_PER_PLAYER = 3;
  const STORE = "between-us-v1";
  const MOTION = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const animate = (el, frames, duration, easing = "ease-out") =>
    MOTION && el.animate ? el.animate(frames, { duration, easing }) : null;

  // Deck colors are computed once here (no CSS color-mix, which older iPhones don't support).
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = rgb(a), B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
  };
  DECKS.forEach((d) => {
    d.vars = {
      "--c": d.color,
      "--c-dark": mix(d.color, "#1d1424", 0.5),
      "--c-soft": mix(d.color, "#ffffff", 0.78),
      "--c-line": mix(d.color, "#fff7f0", 0.5),
      "--c-ink": mix(d.color, "#3a1a33", 0.35),
    };
  });
  const paint = (el, deck) => Object.entries(deck.vars).forEach(([k, v]) => el.style.setProperty(k, v));

  // A card is referenced by "deckId:index" so saved games and favorites stay small.
  const cardOf = (key) => {
    const [deckId, i] = String(key).split(":");
    const deck = deckById[deckId];
    const card = deck && deck.cards[+i];
    return card ? { key, deck, card, index: +i } : null;
  };

  // ---------- saved state ----------
  const state = {
    names: ["", ""],
    selected: ["p1"],
    shuffle: false,
    adultOk: false,
    favorites: [],
    session: null, // { queue: [key], pos, turn, jokers: [n, n], flipped }
  };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STORE) || "{}"));
  } catch { /* corrupted storage: start fresh */ }
  // drop anything that no longer exists (renamed decks, removed cards)
  state.selected = (state.selected || []).filter((id) => deckById[id]);
  state.favorites = (state.favorites || []).filter(cardOf);
  if (state.session) {
    const q = (state.session.queue || []).filter(cardOf);
    state.session = q.length && state.session.pos < q.length ? { ...state.session, queue: q } : null;
  }
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private browsing */ }
  };

  const hasNames = () => Boolean(state.names[0] && state.names[1]);

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- 1. welcome: names ----------
  const nameA = $("#name-a");
  const nameB = $("#name-b");
  nameA.value = state.names[0] || "";
  nameB.value = state.names[1] || "";

  function updateNames() {
    state.names = [nameA.value.trim(), nameB.value.trim()];
    save();
    $("#names-ok").disabled = !hasNames();
    $("#name-hint").classList.toggle("hidden", hasNames());
  }
  nameA.addEventListener("input", updateNames);
  nameB.addEventListener("input", updateNames);

  $("#names-form").addEventListener("submit", (e) => {
    e.preventDefault();
    updateNames();
    if (!hasNames()) return (state.names[0] ? nameB : nameA).focus();
    document.activeElement.blur(); // closes the phone keyboard
    goHome();
  });
  $("#change-names").addEventListener("click", () => show("welcome"));

  // ---------- 2. home: decks ----------
  const deckTiles = {};
  const shuffleBox = $("#shuffle");

  function buildDecks() {
    const list = $("#deck-list");
    const groups = [...new Set(DECKS.map((d) => d.group))];
    list.innerHTML = groups
      .map((g) => {
        const decks = DECKS.filter((d) => d.group === g);
        const allBtn = decks.every((d) => d.ordered) ? `<button type="button" data-all="${esc(g)}">Play all in a row</button>` : "";
        return `<div class="group-title"><span>${esc(g)}</span>${allBtn}</div>
          <div class="deck-grid">${decks
            .map((d) => `<button type="button" class="deck" data-deck="${d.id}">
                <span class="deck-emoji">${d.emoji}</span>
                <span class="deck-name">${esc(d.name)}</span>
                <span class="deck-sub">${esc(d.subtitle)}</span>
                <span class="deck-count">${d.cards.length} cards</span>
              </button>`)
            .join("")}</div>`;
      })
      .join("");
    list.querySelectorAll(".deck").forEach((b) => {
      deckTiles[b.dataset.deck] = b;
      paint(b, deckById[b.dataset.deck]);
    });
    // one listener for all tiles and "play all in a row" buttons
    list.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-deck]");
      if (tile) return toggleDeck(deckById[tile.dataset.deck]);
      const all = e.target.closest("[data-all]");
      if (all) {
        state.selected = DECKS.filter((d) => d.group === all.dataset.all).map((d) => d.id);
        state.shuffle = shuffleBox.checked = false;
        save();
        updateDecks();
      }
    });
  }

  function updateDecks() {
    for (const [id, tile] of Object.entries(deckTiles)) {
      const on = state.selected.includes(id);
      tile.classList.toggle("selected", on);
      tile.setAttribute("aria-pressed", on);
    }
    $("#start").disabled = state.selected.length === 0;
  }

  function toggleDeck(d) {
    const on = state.selected.includes(d.id);
    if (!on && d.adult && !state.adultOk) {
      return openModal("#adult-modal", () => {
        state.adultOk = true;
        toggleDeck(d);
      });
    }
    // keep decks in their defined order
    state.selected = DECKS.map((x) => x.id).filter((id) => (id === d.id ? !on : state.selected.includes(id)));
    save();
    updateDecks();
  }

  shuffleBox.checked = state.shuffle;
  shuffleBox.addEventListener("change", () => {
    state.shuffle = shuffleBox.checked;
    save();
  });

  const updateFavCount = () => {
    $("#fav-count").textContent = state.favorites.length ? `(${state.favorites.length})` : "";
  };

  function goHome() {
    if (!hasNames()) return show("welcome");
    stopTimer();
    $("#home-name-a").textContent = state.names[0];
    $("#home-name-b").textContent = state.names[1];
    $("#resume").classList.toggle("hidden", !state.session);
    updateFavCount();
    updateDecks();
    show("home");
  }

  function shuffled(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame(queue) {
    if (!queue.length) return;
    if (!hasNames()) return show("welcome");
    state.session = { queue, pos: 0, turn: 0, jokers: [JOKERS_PER_PLAYER, JOKERS_PER_PLAYER], flipped: false };
    save();
    show("play");
    render(true);
  }

  $("#start").addEventListener("click", () => {
    const queue = state.selected.flatMap((id) => deckById[id].cards.map((_, i) => `${id}:${i}`));
    startGame(state.shuffle ? shuffled(queue) : queue);
  });
  $("#resume").addEventListener("click", () => {
    if (!state.session) return;
    show("play");
    render(false);
  });

  // ---------- 3. game ----------
  // One card element is reused for every card. Flipping is a flat scaleX animation:
  // no 3D, so nothing from the back can show through the front.
  const table = $("#table");
  const card = $("#card");
  const [stack2, stack1] = table.querySelectorAll(".stack");

  function cardHTML({ deck, card: c, index }) {
    const label = c.type === "game" ? "Mini-game" : c.type === "timer" ? "Timer" : "Question";
    const num = deck.ordered ? `${index + 1} / ${deck.cards.length}` : label;
    const timer = c.type === "timer"
      ? `<div class="timer" data-sec="${c.seconds}">
           <div class="timer-ring"><span>${fmt(c.seconds)}</span></div>
           <button type="button">Start</button>
         </div>`
      : "";
    return `
      <div class="face back">
        <div class="back-emoji">${deck.emoji}</div>
        <div class="back-name">${esc(deck.name)}</div>
        <div class="back-sub">${esc(deck.subtitle)}</div>
        <div class="back-tap">Tap to flip</div>
      </div>
      <div class="face front">
        <div class="front-head"><span class="tag">${esc(deck.name)}</span><span>${esc(num)}</span></div>
        <div class="front-body">
          <p class="question">${esc(c.text)}</p>
          ${c.hint ? `<p class="hint">${esc(c.hint)}</p>` : ""}
          ${timer}
        </div>
        <div class="front-foot">♥</div>
      </div>`;
  }

  function render(dealIn) {
    stopTimer();
    const s = state.session;
    if (!s) return goHome();
    if (s.pos >= s.queue.length) return finish();

    const entry = cardOf(s.queue[s.pos]);
    if (card.getAnimations) card.getAnimations().forEach((a) => a.cancel());
    card.style.transform = "";
    paint(card, entry.deck);
    card.innerHTML = cardHTML(entry);
    card.classList.toggle("flipped", Boolean(s.flipped));

    // decorative stack behind the card, in the color of the next card
    const left = s.queue.length - s.pos - 1;
    stack1.classList.toggle("hidden", left < 1);
    stack2.classList.toggle("hidden", left < 2);
    const nextEntry = left > 0 && cardOf(s.queue[s.pos + 1]);
    if (nextEntry) table.style.setProperty("--next-c", nextEntry.deck.vars["--c-dark"]);

    $("#progress-text").textContent = `Card ${s.pos + 1} of ${s.queue.length}`;
    $("#progress-fill").style.transform = `scaleX(${(s.pos + 1) / s.queue.length})`;
    $("#turn").innerHTML = `First up: <b>${esc(state.names[s.turn])}</b>`;
    $("#joker-count").textContent = `×${s.jokers[s.turn]}`;
    $("#joker").disabled = s.jokers[s.turn] <= 0;
    setFavButton(state.favorites.includes(entry.key));
    updateHint();

    if (dealIn) {
      animate(card, [
        { transform: "translateY(14px) scale(0.96)", opacity: 0.6 },
        { transform: "none", opacity: 1 },
      ], 200);
    }
  }

  function updateHint() {
    $("#swipe-hint").textContent = state.session && state.session.flipped
      ? "Take turns answering, then swipe or tap →"
      : "Tap the card to flip it";
  }

  function flip() {
    const s = state.session;
    if (!s || s.flipped) return;
    s.flipped = true;
    save();
    card.classList.add("flipped"); // the final state is set at once; the animation is only visual
    updateHint();
    const [back, front] = card.children;
    animate(card, [
      { transform: "scaleX(1)", easing: "ease-in" },
      { transform: "scaleX(0)", offset: 0.5, easing: "ease-out" },
      { transform: "scaleX(1)" },
    ], 260, "linear");
    // the back is visible during the first half, the front during the second half
    animate(back, [{ visibility: "visible" }, { visibility: "visible", offset: 0.5 }, { visibility: "hidden", offset: 0.5 }, { visibility: "hidden" }], 260, "linear");
    animate(front, [{ visibility: "hidden" }, { visibility: "hidden", offset: 0.5 }, { visibility: "visible", offset: 0.5 }, { visibility: "visible" }], 260, "linear");
  }

  // Moving on never waits for an animation: the old card is cloned and flies away
  // on top, while the next card is already in place underneath.
  function advance(dir) {
    const s = state.session;
    if (!s) return;
    stopTimer();
    if (MOTION && card.animate) {
      const ghost = card.cloneNode(true);
      ghost.removeAttribute("id");
      ghost.removeAttribute("role");
      ghost.removeAttribute("tabindex");
      ghost.classList.add("ghost");
      table.appendChild(ghost);
      const sign = dir === "right" ? 1 : -1;
      const fly = ghost.animate([
        { transform: card.style.transform || "none", opacity: 1 },
        { transform: `translateX(${sign * 130}%) rotate(${sign * 16}deg)`, opacity: 0 },
      ], { duration: 260, easing: "ease-in", fill: "forwards" });
      fly.onfinish = fly.oncancel = () => ghost.remove();
    }
    s.pos++;
    s.turn = 1 - s.turn;
    s.flipped = false;
    save();
    render(true);
  }

  // Tap = flip. Horizontal drag on a flipped card = next card. Vertical moves scroll the page.
  let drag = null;
  let frame = 0;
  card.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary || e.button > 0 || e.target.closest("button")) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, active: false, moved: false };
  });
  card.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      drag.moved = true;
      if (!state.session.flipped || Math.abs(dy) > Math.abs(dx)) return;
      drag.active = true;
      if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
    }
    drag.dx = dx;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (drag) card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 20}deg)`;
      });
    }
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.active) {
      if (!d.moved && e.type === "pointerup") flip();
      return;
    }
    cancelAnimationFrame(frame);
    frame = 0;
    if (Math.abs(d.dx) > 80) return advance(d.dx < 0 ? "left" : "right");
    const from = card.style.transform;
    card.style.transform = "";
    animate(card, [{ transform: from }, { transform: "none" }], 180);
  }
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);

  // ---------- timer (on some cards) ----------
  let timer = null; // { left, id }
  function stopTimer() {
    if (timer) clearInterval(timer.id);
    timer = null;
  }
  card.addEventListener("click", (e) => {
    const box = e.target.closest(".timer");
    if (!box || !e.target.closest("button")) return;
    const btn = box.querySelector("button");
    const ring = box.querySelector(".timer-ring");
    const label = ring.firstElementChild;
    const total = +box.dataset.sec;
    if (timer && timer.id) { // pause
      clearInterval(timer.id);
      timer.id = 0;
      btn.textContent = "Resume";
      return;
    }
    if (!timer || timer.left <= 0) { // (re)start from the full time
      timer = { left: total, id: 0 };
      box.classList.remove("done");
    }
    btn.textContent = "Pause";
    timer.id = setInterval(() => {
      timer.left--;
      ring.style.setProperty("--p", timer.left / total);
      label.textContent = timer.left > 0 ? fmt(timer.left) : "✓";
      if (timer.left <= 0) {
        clearInterval(timer.id);
        timer.id = 0;
        box.classList.add("done");
        btn.textContent = "Restart";
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  });

  // ---------- game buttons ----------
  const next = () => (state.session && !state.session.flipped ? flip() : advance("left"));
  $("#next").addEventListener("click", next);

  $("#joker").addEventListener("click", () => {
    const s = state.session;
    if (!s || s.jokers[s.turn] <= 0) return;
    s.jokers[s.turn]--;
    advance("right");
  });

  function setFavButton(on) {
    $("#fav").classList.toggle("on", on);
    $("#fav-icon").textContent = on ? "♥" : "♡";
  }
  $("#fav").addEventListener("click", () => {
    const s = state.session;
    if (!s) return;
    const key = s.queue[s.pos];
    const on = !state.favorites.includes(key);
    state.favorites = on ? [...state.favorites, key] : state.favorites.filter((k) => k !== key);
    save();
    setFavButton(on);
  });

  $("#back").addEventListener("click", goHome);

  // keyboard (computer): → , Enter or Space = next; Escape closes windows
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return closeModals();
    if (!$("#play").classList.contains("active") || e.target.closest("button")) return;
    if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      next();
    }
  });

  // ---------- 4. end ----------
  function finish() {
    const n = state.session ? state.session.queue.length : 0;
    state.session = null;
    save();
    $("#end-text").textContent =
      `${n} card${n > 1 ? "s" : ""} later, you know each other a little better. ` +
      "Save the questions you loved to your favorites for your next date.";
    show("end");
  }
  $("#end-home").addEventListener("click", goHome);
  $("#end-favs").addEventListener("click", openFavs);

  // ---------- modals ----------
  let onModalYes = null;
  function openModal(sel, onYes) {
    onModalYes = onYes || null;
    $(sel).classList.remove("hidden");
  }
  function closeModals() {
    document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
  }
  document.querySelectorAll(".modal").forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target === m) closeModals(); }));
  $("#adult-no").addEventListener("click", closeModals);
  $("#adult-yes").addEventListener("click", () => {
    closeModals();
    if (onModalYes) onModalYes();
  });

  // ---------- favorites ----------
  function openFavs() {
    const entries = state.favorites.map(cardOf);
    const list = $("#favs-list");
    list.innerHTML = entries.length
      ? entries.map((e) => `<li data-key="${e.key}">
          <small>${e.deck.emoji} ${esc(e.deck.name)}</small>${esc(e.card.text)}
          <button type="button" aria-label="Remove">✕</button>
        </li>`).join("")
      : `<li class="empty">No favorites yet. Tap ♡ during the game to keep a card.</li>`;
    list.querySelectorAll("li[data-key]").forEach((li) => paint(li, cardOf(li.dataset.key).deck));
    $("#play-favs").disabled = !entries.length;
    openModal("#favs-modal");
  }
  $("#favs-list").addEventListener("click", (e) => {
    const li = e.target.closest("button") && e.target.closest("li[data-key]");
    if (!li) return;
    state.favorites = state.favorites.filter((k) => k !== li.dataset.key);
    save();
    updateFavCount();
    openFavs();
  });
  $("#open-favs").addEventListener("click", openFavs);
  $("#close-favs").addEventListener("click", closeModals);
  $("#play-favs").addEventListener("click", () => {
    closeModals();
    startGame(shuffled([...state.favorites]));
  });

  // ---------- startup ----------
  buildDecks();
  updateNames();
})();
