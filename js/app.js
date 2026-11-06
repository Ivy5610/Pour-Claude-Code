(() => {
  "use strict";

  const DECKS = window.DECKS;
  const deckById = Object.fromEntries(DECKS.map((d) => [d.id, d]));
  const JOKERS_PER_PLAYER = 3;
  const STORE = "between-us-v1";

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- persistent state ----------
  const defaults = {
    names: ["", ""],
    selected: ["p1"],
    shuffle: false,
    adultOk: false,
    favorites: [], // ["deckId:index"]
    session: null, // { queue: ["deckId:index"], pos, turn, jokers: [n, n] }
  };
  let state;
  try {
    state = Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || "{}"));
  } catch {
    state = { ...defaults };
  }
  // drop decks that no longer exist
  state.selected = (state.selected || []).filter((id) => deckById[id]);
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private browsing */ }
  };

  const keyOf = (deckId, i) => `${deckId}:${i}`;
  const cardOf = (key) => {
    const [deckId, i] = key.split(":");
    const deck = deckById[deckId];
    if (!deck || !deck.cards[+i]) return null;
    return { deck, card: deck.cards[+i], index: +i, key };
  };
  const nameOf = (p) => state.names[p] || (p === 0 ? "You" : "Your date");

  // ---------- navigation ----------
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- home ----------
  const nameA = $("#name-a");
  const nameB = $("#name-b");
  nameA.value = state.names[0];
  nameB.value = state.names[1];
  const hasNames = () => Boolean(state.names[0] && state.names[1]);
  // Both names are required before anything can be played.
  function updateGate() {
    const ok = hasNames();
    $("#start").disabled = !ok || state.selected.length === 0;
    $("#resume").disabled = !ok;
    $("#name-hint").classList.toggle("hidden", ok);
    nameA.classList.toggle("missing", !state.names[0]);
    nameB.classList.toggle("missing", !state.names[1]);
    const fav = $("#play-favs");
    if (fav) fav.disabled = !ok || !state.favorites.some(cardOf);
  }
  nameA.addEventListener("input", () => { state.names[0] = nameA.value.trim(); save(); updateGate(); });
  nameB.addEventListener("input", () => { state.names[1] = nameB.value.trim(); save(); updateGate(); });

  const shuffleBox = $("#shuffle");
  shuffleBox.checked = state.shuffle;
  shuffleBox.addEventListener("change", () => { state.shuffle = shuffleBox.checked; save(); });

  function renderDecks() {
    const list = $("#deck-list");
    list.innerHTML = "";
    const groups = [...new Set(DECKS.map((d) => d.group))];
    groups.forEach((g) => {
      const decks = DECKS.filter((d) => d.group === g);
      const title = el("div", "group-title", `<span>${esc(g)}</span>`);
      if (g === "The 36 Questions") {
        const all = el("button", null, "All 36 in a row");
        all.onclick = () => {
          state.selected = decks.map((d) => d.id);
          state.shuffle = false;
          shuffleBox.checked = false;
          save();
          renderDecks();
        };
        title.appendChild(all);
      }
      list.appendChild(title);
      const grid = el("div", "deck-grid");
      decks.forEach((d) => {
        const b = el(
          "button",
          "deck" + (state.selected.includes(d.id) ? " selected" : ""),
          `<span class="deck-emoji">${d.emoji}</span>
           <span class="deck-name">${esc(d.name)}</span>
           <span class="deck-sub">${esc(d.subtitle)}</span>
           <span class="deck-count">${d.cards.length} cards</span>`
        );
        b.style.setProperty("--c", d.color);
        b.setAttribute("aria-pressed", state.selected.includes(d.id));
        b.onclick = () => toggleDeck(d);
        grid.appendChild(b);
      });
      list.appendChild(grid);
    });
    updateGate();
  }

  function toggleDeck(d) {
    const on = state.selected.includes(d.id);
    if (!on && d.adult && !state.adultOk) {
      openAdult(() => { state.adultOk = true; toggleDeck(d); });
      return;
    }
    state.selected = on ? state.selected.filter((x) => x !== d.id) : [...state.selected, d.id];
    // keep decks in their defined order
    state.selected = DECKS.map((x) => x.id).filter((id) => state.selected.includes(id));
    save();
    renderDecks();
  }

  function openAdult(onYes) {
    const m = $("#adult-modal");
    m.classList.remove("hidden");
    $("#adult-yes").onclick = () => { m.classList.add("hidden"); onYes(); };
    $("#adult-no").onclick = () => m.classList.add("hidden");
  }

  function refreshHome() {
    const s = state.session;
    $("#resume").classList.toggle("hidden", !(s && s.pos < s.queue.length));
    $("#fav-count").textContent = state.favorites.length ? `(${state.favorites.length})` : "";
    renderDecks();
  }

  function shuffleArr(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startGame(queue) {
    if (!queue.length) return;
    if (!hasNames()) { show("home"); refreshHome(); (state.names[0] ? nameB : nameA).focus(); return; }
    state.session = { queue, pos: 0, turn: 0, jokers: [JOKERS_PER_PLAYER, JOKERS_PER_PLAYER], flipped: false };
    save();
    show("play");
    renderTable(true);
  }

  $("#start").onclick = () => {
    let queue = [];
    state.selected.forEach((id) => deckById[id].cards.forEach((_, i) => queue.push(keyOf(id, i))));
    if (state.shuffle) queue = shuffleArr(queue);
    startGame(queue);
  };
  $("#resume").onclick = () => {
    if (!hasNames()) return updateGate();
    show("play");
    renderTable(true);
  };

  // ---------- game ----------
  const table = $("#table");
  let timerHandle = null;

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function buildCard(entry, cls) {
    const { deck, card, index } = entry;
    const c = el("div", "card " + (cls || ""));
    c.style.setProperty("--c", deck.color);
    const label = card.type === "game" ? "Mini-game" : card.type === "timer" ? "Timer" : "Question";
    const num = deck.ordered ? `${index + 1} / ${deck.cards.length}` : label;
    c.innerHTML = `
      <div class="card-inner">
        <div class="face back">
          <div class="back-emoji">${deck.emoji}</div>
          <div class="back-name">${esc(deck.name)}</div>
          <div class="back-sub">${esc(deck.subtitle)}</div>
          <div class="back-tap">Tap to flip</div>
        </div>
        <div class="face front">
          <span class="corner br">${deck.emoji}</span>
          <div class="front-head">
            <span class="tag">${esc(deck.name)}</span>
            <span>${esc(num)}</span>
          </div>
          <div class="front-body">
            <p class="question">${esc(card.text)}</p>
            ${card.hint ? `<p class="hint">${esc(card.hint)}</p>` : ""}
            ${card.type === "timer" ? timerHTML(card.seconds) : ""}
          </div>
          <div class="front-foot">♥</div>
        </div>
      </div>`;
    return c;
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function timerHTML(sec) {
    return `<div class="timer" data-sec="${sec}">
      <div class="timer-ring"><span>${fmt(sec)}</span></div>
      <button type="button">Start</button>
    </div>`;
  }

  function wireTimer(cardEl) {
    const t = cardEl.querySelector(".timer");
    if (!t) return;
    const total = +t.dataset.sec;
    const ring = t.querySelector(".timer-ring");
    const label = ring.querySelector("span");
    const btn = t.querySelector("button");
    let left = total;
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (timerHandle) { stopTimer(); btn.textContent = "Resume"; return; }
      if (left <= 0) { left = total; t.classList.remove("done"); }
      btn.textContent = "Pause";
      timerHandle = setInterval(() => {
        left--;
        label.textContent = fmt(Math.max(left, 0));
        ring.style.setProperty("--p", left / total);
        if (left <= 0) {
          stopTimer();
          t.classList.add("done");
          label.textContent = "✓";
          btn.textContent = "Restart";
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
      }, 1000);
    });
  }

  function renderTable(fresh) {
    stopTimer();
    const s = state.session;
    if (!s) return show("home");
    if (s.pos >= s.queue.length) return finish();

    table.innerHTML = "";
    // cards underneath (stack effect)
    [2, 1].forEach((offset) => {
      const k = s.queue[s.pos + offset];
      const e = k && cardOf(k);
      if (e) table.appendChild(buildCard(e, offset === 1 ? "under" : "under2"));
    });

    const entry = cardOf(s.queue[s.pos]);
    if (!entry) { s.pos++; save(); return renderTable(); }
    const c = buildCard(entry, fresh ? "enter" : "");
    if (s.flipped) c.classList.add("flipped");
    table.appendChild(c);
    wireTimer(c);
    wireSwipe(c);

    // header
    const total = s.queue.length;
    $("#progress-text").textContent = `Card ${s.pos + 1} of ${total}`;
    $("#progress-fill").style.width = `${((s.pos + 1) / total) * 100}%`;
    $("#turn").innerHTML = `First up: <b>${esc(nameOf(s.turn))}</b>`;
    $("#joker-count").textContent = `×${s.jokers[s.turn]}`;
    $("#joker").disabled = s.jokers[s.turn] <= 0;
    const isFav = state.favorites.includes(entry.key);
    $("#fav").classList.toggle("on", isFav);
    $("#fav-icon").textContent = isFav ? "♥" : "♡";
    updateHint(c);
  }

  function updateHint(c) {
    $("#swipe-hint").textContent = c.classList.contains("flipped")
      ? "Take turns answering, then swipe the card →"
      : "Tap the card to flip it";
  }

  function flip(c) {
    if (c.classList.contains("flipped")) return;
    c.classList.add("flipped");
    state.session.flipped = true;
    save();
    updateHint(c);
  }

  function advance(dir = "left") {
    const s = state.session;
    if (!s) return;
    const c = table.querySelector(".card:last-child");
    stopTimer();
    const go = () => {
      s.pos++;
      s.turn = 1 - s.turn;
      s.flipped = false;
      save();
      renderTable(true);
    };
    if (c) {
      c.classList.add(dir === "right" ? "fly-right" : "fly-left");
      setTimeout(go, 280);
    } else go();
  }

  function wireSwipe(c) {
    let startX = 0, startY = 0, dx = 0, dragging = false, moved = false;
    c.addEventListener("pointerdown", (e) => {
      startX = e.clientX; startY = e.clientY; dx = 0; moved = false;
      dragging = c.classList.contains("flipped");
      if (dragging) { c.classList.add("dragging"); c.setPointerCapture(e.pointerId); }
    });
    c.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 6 || Math.abs(e.clientY - startY) > 6) moved = true;
      c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      c.classList.remove("dragging");
      c.style.transform = "";
      if (Math.abs(dx) > 90) advance(dx < 0 ? "left" : "right");
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("click", () => { if (!moved) flip(c); });
  }

  $("#next").onclick = () => {
    const c = table.querySelector(".card:last-child");
    if (c && !c.classList.contains("flipped")) return flip(c);
    advance("left");
  };

  $("#joker").onclick = () => {
    const s = state.session;
    if (!s || s.jokers[s.turn] <= 0) return;
    s.jokers[s.turn]--;
    save();
    advance("right");
  };

  $("#fav").onclick = () => {
    const s = state.session;
    const k = s && s.queue[s.pos];
    if (!k) return;
    const i = state.favorites.indexOf(k);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.push(k);
    save();
    const on = i < 0;
    $("#fav").classList.toggle("on", on);
    $("#fav-icon").textContent = on ? "♥" : "♡";
  };

  $("#back").onclick = () => { stopTimer(); show("home"); refreshHome(); };

  document.addEventListener("keydown", (e) => {
    if (!$("#play").classList.contains("active")) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); $("#next").click(); }
  });

  // ---------- end ----------
  function finish() {
    stopTimer();
    const n = state.session ? state.session.queue.length : 0;
    state.session = null;
    save();
    $("#end-text").textContent =
      `${n} card${n > 1 ? "s" : ""} later, you know each other a little better. ` +
      `Save the questions you loved to your favorites for your next date.`;
    show("end");
  }
  $("#end-home").onclick = () => { show("home"); refreshHome(); };
  $("#end-favs").onclick = openFavs;

  // ---------- favorites ----------
  function openFavs() {
    const list = $("#favs-list");
    list.innerHTML = "";
    const entries = state.favorites.map(cardOf).filter(Boolean);
    if (!entries.length) {
      list.appendChild(el("li", "empty", "No favorites yet. Tap ♡ during the game to keep a card."));
    }
    entries.forEach((e) => {
      const li = el("li", null, `<small>${e.deck.emoji} ${esc(e.deck.name)}</small>${esc(e.card.text)}`);
      li.style.setProperty("--c", e.deck.color);
      const del = el("button", null, "✕");
      del.setAttribute("aria-label", "Remove");
      del.onclick = () => {
        state.favorites = state.favorites.filter((k) => k !== e.key);
        save();
        openFavs();
        refreshHome();
      };
      li.appendChild(del);
      list.appendChild(li);
    });
    updateGate();
    $("#favs-modal").classList.remove("hidden");
  }
  const closeFavs = () => $("#favs-modal").classList.add("hidden");
  $("#open-favs").onclick = openFavs;
  $("#close-favs").onclick = closeFavs;
  $("#favs-modal").addEventListener("click", (e) => { if (e.target.id === "favs-modal") closeFavs(); });
  $("#play-favs").onclick = () => {
    closeFavs();
    startGame(shuffleArr(state.favorites.filter((k) => cardOf(k))));
  };

  // ---------- startup ----------
  refreshHome();
})();
