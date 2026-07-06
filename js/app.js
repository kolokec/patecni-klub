import { createApi } from "./api.js";

// ---------- Stav ----------

let api;
let data = { members: [], games: [], events: [], wishlist: [] };
let me = null;        // přihlášený člen
let hostView = null;  // člen, jehož sbírku si prohlíží host
let playerFilter = "all";

const $ = (id) => document.getElementById(id);

// ---------- Pomocné ----------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "style") node.style.cssText = v;
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function isFriday(iso) {
  return new Date(iso + "T12:00:00").getDay() === 5;
}

function nextFridays(count) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1); // dnešní pátek se ještě počítá
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 7);
  }
  return out;
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const gamesCount = (n) => n === 1 ? "1 hra" : n >= 2 && n <= 4 ? `${n} hry` : `${n} her`;
const memberById = (id) => data.members.find((m) => m.id === id);
const gameById = (id) => data.games.find((g) => g.id === id);

function playersLabel(g) {
  if (!g.min_players && !g.max_players) return "počet hráčů neuveden";
  if (g.min_players === g.max_players) return `${g.min_players} hráči`;
  if ((g.max_players ?? 99) >= 99) return `${g.min_players}+ hráčů`;
  return `${g.min_players}–${g.max_players} hráčů`;
}

// Statistiky hry napříč odehranými termíny
function gameStats(game) {
  const played = data.events.filter(
    (e) => e.event_date <= todayISO() && e.games.some((eg) => eg.kind === "played" && eg.game_id === game.id)
  );
  const scores = played.flatMap((e) => e.ratings.map((r) => r.score));
  return {
    count: played.length,
    last: played.length ? fmtDate(played[played.length - 1].event_date) : null,
    avg: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1).replace(".", ",") : null,
  };
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 4000);
}

async function reload() {
  data = await api.loadAll();
  me = data.members.find((m) => m.id === api.getSessionMemberId()) || null;
  render();
}

// ---------- Našeptávač názvů her ----------

function attachSuggest(input, box, onPick) {
  const close = () => { box.hidden = true; box.textContent = ""; };
  input.addEventListener("input", () => {
    delete input.dataset.gameId;
    const q = norm(input.value);
    if (!q) return close();
    const hits = data.games.filter((g) => norm(g.name).includes(q)).slice(0, 8);
    box.textContent = "";
    if (!hits.length) return close();
    for (const g of hits) {
      box.append(el("button", {
        type: "button", class: "suggest-item", text: g.name,
        onclick: () => {
          input.value = g.name;
          input.dataset.gameId = g.id;
          close();
          if (onPick) onPick(g);
        },
      }));
    }
    box.hidden = false;
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

// Vrátí existující hru podle výběru/názvu, nebo ji založí
async function resolveGame(input) {
  const name = input.value.trim();
  if (!name) throw new Error("Zadej název hry.");
  if (input.dataset.gameId) return gameById(input.dataset.gameId);
  const existing = data.games.find((g) => norm(g.name) === norm(name));
  if (existing) return existing;
  return await api.findOrCreateGame(name);
}

// ---------- Hlavička / přihlášení ----------

function renderLogin() {
  const area = $("loginArea");
  area.textContent = "";

  if (hostView) {
    area.append(
      el("p", { class: "login-label", text: `Host · sbírka: ${hostView.display_name}` }),
      el("div", { class: "login-tiles" }, [
        el("button", { class: "btn btn-ghost", text: "Odejít", onclick: () => { hostView = null; render(); } }),
      ])
    );
    return;
  }

  if (me) {
    area.append(
      el("p", { class: "login-label", html: `Ahoj, <b>${me.display_name}</b>` }),
      el("div", { class: "login-tiles" }, [
        el("button", { class: "avatar", style: `--hue:${me.hue}`, text: me.initial, title: "Můj profil", onclick: openProfile }),
        el("button", { class: "btn btn-ghost", text: "Odhlásit", onclick: async () => { await api.signOut(); me = null; await reload(); } }),
      ])
    );
    return;
  }

  area.append(
    el("p", { class: "login-label", html: `Kdo su? <b>:o)</b>` }),
    el("div", { class: "login-tiles" }, [
      ...data.members.map((m) =>
        el("button", { class: "avatar", style: `--hue:${m.hue}`, text: m.initial, onclick: () => openPassword(m) })),
      el("button", { class: "avatar avatar--host", text: "Host", onclick: openHostPick }),
    ])
  );
}

function openPassword(member) {
  const dlg = $("dlgPassword");
  $("pwAvatar").textContent = member.initial;
  $("pwAvatar").style.setProperty("--hue", member.hue);
  $("pwTitle").textContent = "Přihlášení";
  $("pwInput").value = "";
  $("pwError").hidden = true;
  $("formPassword").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api.signIn(member, $("pwInput").value);
      dlg.close();
      await reload();
      if (me && !me.password_set) {
        openProfile(true); // první přihlášení: vyzvat k nastavení vlastního hesla
      } else {
        toast(`Vítej zpátky, ${me?.display_name ?? member.display_name}!`);
      }
    } catch (err) {
      $("pwError").textContent = err.message;
      $("pwError").hidden = false;
    }
  };
  dlg.showModal();
}

function openHostPick() {
  const box = $("hostTiles");
  box.textContent = "";
  for (const m of data.members) {
    box.append(el("button", {
      class: "avatar", style: `--hue:${m.hue}`, text: m.initial,
      onclick: () => { $("dlgHostPick").close(); openHostQuestion(m); },
    }));
  }
  $("dlgHostPick").showModal();
}

function openHostQuestion(member) {
  const dlg = $("dlgHostQuestion");
  $("hqTitle").textContent = `Sbírka: ${member.display_name}`;
  $("hqError").hidden = true;
  $("hqInput").value = "";
  if (!member.host_question) {
    $("hqQuestion").textContent = `${member.display_name} si zatím nenastavil(a) otázku pro hosty – jeho sbírku teď nejde zobrazit.`;
    $("formHostQuestion").querySelector("[type=submit]").hidden = true;
  } else {
    $("hqQuestion").textContent = member.host_question;
    $("formHostQuestion").querySelector("[type=submit]").hidden = false;
  }
  $("formHostQuestion").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const ok = await api.checkHostAnswer(member.slug, $("hqInput").value);
      if (!ok) throw new Error("To bohužel není správně.");
      dlg.close();
      hostView = member;
      render();
    } catch (err) {
      $("hqError").textContent = err.message;
      $("hqError").hidden = false;
    }
  };
  dlg.showModal();
}

// ---------- Lišta akcí člena ----------

function renderActions() {
  const bar = $("memberActions");
  bar.textContent = "";
  bar.hidden = !me || !!hostView;
  if (bar.hidden) return;
  bar.append(
    el("button", { class: "btn btn-primary", text: "+ Přidat hru", onclick: openAddGame }),
    el("button", { class: "btn btn-ghost", text: "+ Do hledáčku", onclick: openWishlist }),
  );
  if (me.is_admin) {
    bar.append(el("button", { class: "btn btn-ghost", text: "✎ Zapsat termín", onclick: () => openEventEditor(null) }));
  }
}

// ---------- Kalendář ----------

function renderCalendar() {
  $("calendarRail").hidden = !!hostView; // host kalendář nevidí
  if (hostView) return;
  const list = $("calList");
  list.textContent = "";
  const today = todayISO();

  const past = data.events.filter((e) => e.event_date <= today && e.games.some((g) => g.kind === "played"));
  // celá historie od založení – posuvná, otevírá se sjetá na nejnovější termín
  const pastWrap = el("li", { class: "cal-past" });
  const pastList = el("ol", { class: "cal-sublist" });

  past.forEach((ev, i) => {
    const isLast = i === past.length - 1;
    const scale = isLast ? 7 : Math.max(1, 6 - (past.length - 1 - i));
    const row = el("li", {
      class: "cal-row" + (isLast ? " cal-row--now" : "") + (isFriday(ev.event_date) ? "" : " cal-row--offday"),
      style: `--scale:${scale}`,
    });
    if (isLast) row.append(el("span", { class: "cal-eyebrow", text: "Naposled" }));
    row.append(el("span", { class: "cal-date", text: fmtDate(ev.event_date) + (isFriday(ev.event_date) ? "" : " · mimo pátek") }));
    for (const eg of ev.games.filter((g) => g.kind === "played")) {
      const g = gameById(eg.game_id);
      row.append(el("span", { class: "cal-game", text: g ? g.name + (eg.note ? ` (${eg.note})` : "") : "?" }));
    }
    // hodnocení: jen účastník; úprava: jen admin
    const tools = el("span", { class: "cal-tools" });
    if (me && ev.participants.includes(me.id)) {
      const mine = ev.ratings.find((r) => r.member_id === me.id);
      tools.append(el("button", {
        class: "cal-tool", text: mine ? `★ ${mine.score}` : "★",
        title: "Ohodnotit termín (1–10)", onclick: () => openRate(ev),
      }));
    }
    if (me?.is_admin) {
      tools.append(el("button", { class: "cal-tool", text: "✎", title: "Upravit termín", onclick: () => openEventEditor(ev) }));
    }
    if (tools.childNodes.length) row.append(tools);
    pastList.append(row);
  });
  pastWrap.append(pastList);
  list.append(pastWrap);

  list.append(el("li", { class: "cal-divider", text: `dnes · ${fmtDate(today)}` }));

  // Budoucnost: příštích 6 pátků + případné mimopáteční termíny z DB
  const fridays = nextFridays(6);
  const futureDb = data.events.filter((e) => e.event_date >= today);
  const dates = [...new Set([...fridays, ...futureDb.map((e) => e.event_date)])].sort().slice(0, 7);

  dates.forEach((date, i) => {
    const ev = futureDb.find((e) => e.event_date === date);
    const proposals = ev ? ev.games.filter((g) => g.kind === "proposal") : [];
    const scale = Math.max(6 - i, 1);
    const row = el("li", {
      class: "cal-row cal-row--future" + (proposals.length ? " cal-row--proposal" : " cal-row--empty")
        + (isFriday(date) ? "" : " cal-row--offday"),
      style: `--scale:${scale}`,
    });
    if (i === 0) row.append(el("span", { class: "cal-eyebrow cal-eyebrow--next", text: "Příště" }));
    row.append(el("span", { class: "cal-date", text: fmtDate(date) + (isFriday(date) ? "" : " · mimo pátek") }));
    for (const eg of proposals) {
      const g = gameById(eg.game_id);
      const who = memberById(eg.proposed_by);
      const line = el("span", { class: "cal-game", text: g ? g.name : "?" });
      line.append(el("span", { class: "who", text: who ? ` (${who.initial})` : "" }));
      if (me && eg.proposed_by === me.id) {
        line.append(el("button", {
          class: "cal-tool", text: "×", title: "Zrušit můj návrh",
          onclick: async () => { await guard(() => api.removeProposal(eg.id)); },
        }));
      }
      row.append(line);
    }
    if (me) {
      const tools = el("span", { class: "cal-tools" });
      tools.append(el("button", {
        class: "cal-tool", text: "+ hra", title: "Navrhnout hru na tento termín",
        onclick: () => openPropose(date),
      }));
      if (i === 0) {
        const attending = ev?.participants.includes(me.id);
        tools.append(el("button", {
          class: "cal-tool" + (attending ? " cal-tool--on" : ""),
          text: attending ? "✓ budu tam" : "budu tam",
          title: "Potvrdit účast na nejbližším termínu",
          onclick: attending ? null : async () => {
            await guard(() => api.confirmAttendance(date), "Účast zapsána. Tak v pátek!");
          },
        }));
      }
      row.append(tools);
    }
    list.append(row);
  });

  pastWrap.scrollTop = pastWrap.scrollHeight;
}

// ---------- Galerie ----------

function matchesFilter(g) {
  if (playerFilter === "all") return true;
  const min = g.min_players ?? 1;
  const max = g.max_players ?? 99;
  if (playerFilter === "5plus") return max >= 5;
  return min <= playerFilter && max >= playerFilter;
}

function renderGallery() {
  const main = $("gallery");
  main.textContent = "";
  $("layout").classList.toggle("layout--host", !!hostView);

  // filtr počtu hráčů
  const filters = el("div", { class: "filters" }, [
    el("span", { class: "filters-label", text: "Počet hráčů" }),
    el("div", { class: "pill-row" },
      [["all", "Vše"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], ["5plus", "5+"]].map(([val, label]) =>
        el("button", {
          class: "pill" + (String(playerFilter) === String(val) ? " active" : ""),
          text: label,
          onclick: () => { playerFilter = val; renderGallery(); },
        }))),
  ]);
  main.append(filters);

  const ownedGames = (m) => data.games.filter((g) => g.owners.includes(m.id) && matchesFilter(g))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  const wishlistGames = (m) => data.wishlist.filter((w) => w.member_id === m.id)
    .map((w) => gameById(w.game_id)).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));

  const renderBlock = (member, isMine) => {
    const games = ownedGames(member);
    const wl = wishlistGames(member);
    if (!games.length && !wl.length) return;
    const block = el("section", { class: "owner-block" });
    block.append(el("h2", { class: "owner-title" }, [
      document.createTextNode(isMine ? "Moje hry" : member.display_name),
      el("span", { text: `${isMine ? member.display_name + " · " : ""}${gamesCount(games.length)}` }),
    ]));
    block.append(tilesGrid(games, member));
    if (wl.length) {
      block.append(el("h3", { class: "owner-title owner-title--wish" }, [
        document.createTextNode("Hledáček"),
        el("span", { text: `co si ${isMine ? "přeju" : member.display_name + " přeje"} pořídit` }),
      ]));
      block.append(tilesGrid(wl, member, true));
    }
    main.append(block);
  };

  if (hostView) {
    renderBlock(hostView, false);
    return;
  }

  if (me) {
    renderBlock(me, true);
    for (const m of data.members.filter((m) => m.id !== me.id)) renderBlock(m, false);
  } else {
    // bez přihlášení: všechny hry pohromadě, pak hledáčky členů
    const all = data.games.filter((g) => g.owners.length && matchesFilter(g))
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
    const block = el("section", { class: "owner-block" });
    block.append(el("h2", { class: "owner-title" }, [
      document.createTextNode("Hry klubu"),
      el("span", { text: gamesCount(all.length) }),
    ]));
    block.append(tilesGrid(all, null));
    main.append(block);
    for (const m of data.members) {
      const wl = wishlistGames(m);
      if (!wl.length) continue;
      const wb = el("section", { class: "owner-block" });
      wb.append(el("h2", { class: "owner-title owner-title--wish" }, [
        document.createTextNode(`Hledáček · ${m.display_name}`),
        el("span", { text: "co si přeje pořídit" }),
      ]));
      wb.append(tilesGrid(wl, m, true));
      main.append(wb);
    }
  }
}

function tilesGrid(games, sectionMember, isWishlist = false) {
  const grid = el("div", { class: "tiles" });
  for (const g of games) grid.append(tile(g, sectionMember, isWishlist));
  return grid;
}

function tile(g, sectionMember, isWishlist) {
  const t = el("article", { class: "tile", tabindex: "0" });
  if (g.image_path) {
    t.append(el("img", { class: "tile-img", src: g.image_path, alt: g.name, loading: "lazy" }));
  } else {
    t.classList.add("tile--placeholder");
    t.append(el("div", { class: "ph" }, [
      phIcon(),
      el("span", { text: "Obrázek bude brzy doplněn" }),
    ]));
  }
  // spoluvlastnictví
  if (!isWishlist && sectionMember && g.owners.length > 1) {
    const others = g.owners.filter((id) => id !== sectionMember.id).map((id) => memberById(id)?.initial).join(", ");
    t.append(el("div", { class: "tile-tag", text: `spolu s: ${others}` }));
  }
  t.append(el("div", { class: "tile-caption" }, [
    el("p", { class: "tile-name", text: g.name }),
    el("p", { class: "tile-players", text: playersLabel(g) }),
  ]));

  // info overlay (hover na PC, klepnutí na mobilu)
  const stats = gameStats(g);
  const ownersTxt = g.owners.map((id) => memberById(id)?.initial).join(", ") || "—";
  const info = el("div", { class: "tile-info" }, [
    el("p", { html: `Naposledy: <b>${stats.last ?? "zatím nehráno"}</b>` }),
    el("p", { html: `Odehráno: <b>${stats.count}×</b>` }),
    el("p", { html: `Hodnocení: <b>${stats.avg ? stats.avg + " / 10" : "—"}</b>` }),
    el("p", { html: `Vlastní: <b>${ownersTxt}</b>` }),
    el("p", { html: `Hráčů: <b>${playersLabel(g)}</b>` }),
  ]);

  if (me && !hostView) {
    const btns = el("div", { class: "tile-btns" });
    if (isWishlist && sectionMember?.id === me.id) {
      btns.append(el("button", {
        class: "btn btn-mini", text: "odebrat z hledáčku",
        onclick: (e) => { e.stopPropagation(); guard(() => api.removeWishlist(g.id)); },
      }));
    } else if (!isWishlist) {
      if (g.owners.includes(me.id)) {
        btns.append(el("button", {
          class: "btn btn-mini", text: "upravit / fotka",
          onclick: (e) => { e.stopPropagation(); openGameEdit(g); },
        }));
      } else {
        btns.append(el("button", {
          class: "btn btn-mini", text: "taky mám doma",
          onclick: (e) => { e.stopPropagation(); guard(() => api.addOwner(g.id), "Hra přidána i do tvé sbírky."); },
        }));
        if (!data.wishlist.some((w) => w.member_id === me.id && w.game_id === g.id)) {
          btns.append(el("button", {
            class: "btn btn-mini", text: "do hledáčku",
            onclick: (e) => { e.stopPropagation(); guard(() => api.addWishlist(g.id), "Přidáno do hledáčku."); },
          }));
        }
      }
    }
    if (btns.childNodes.length) info.append(btns);
  }
  t.append(info);

  t.addEventListener("click", () => {
    if (!matchMedia("(hover: none)").matches) return;
    document.querySelectorAll(".tile.show-info").forEach((x) => { if (x !== t) x.classList.remove("show-info"); });
    t.classList.toggle("show-info");
  });
  return t;
}

function phIcon() {
  const span = el("span", { class: "ph-icon", "aria-hidden": "true" });
  span.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="3" y="3" width="18" height="18" rx="3"/>' +
    '<circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>';
  return span;
}

// ---------- Dialogy člena ----------

async function guard(fn, okMsg) {
  try {
    await fn();
    await reload();
    if (okMsg) toast(okMsg);
  } catch (err) {
    toast(err.message);
  }
}

// Po dobu ukládání zablokuje odesílací tlačítko a ukáže „Ukládám…“
function withBusy(form, fn) {
  return async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Ukládám…";
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };
}

// Sroluje na dlaždici hry a krátce ji zvýrazní
function highlightGame(name) {
  const tile = [...document.querySelectorAll(".tile")]
    .find((t) => t.querySelector(".tile-name")?.textContent === name);
  if (!tile) return;
  tile.scrollIntoView({ behavior: "smooth", block: "center" });
  tile.classList.add("tile--new");
  setTimeout(() => tile.classList.remove("tile--new"), 3000);
}

function openAddGame() {
  const dlg = $("dlgAddGame");
  $("agName").value = ""; delete $("agName").dataset.gameId;
  $("agMin").value = ""; $("agMax").value = ""; $("agFile").value = "";
  $("agError").hidden = true;
  $("formAddGame").onsubmit = withBusy($("formAddGame"), async () => {
    const name = $("agName").value.trim();
    try {
      const min = $("agMin").value ? +$("agMin").value : null;
      const max = $("agMax").value ? +$("agMax").value : null;
      const file = $("agFile").files[0] || null;
      const existingId = $("agName").dataset.gameId;
      if (existingId) {
        await api.addOwner(existingId);
        if (min || max) await api.updateGamePlayers(existingId, min, max);
        if (file) await api.uploadImage(existingId, file);
      } else {
        await api.addGame({ name, minPlayers: min, maxPlayers: max, file });
      }
    } catch (err) {
      $("agError").textContent = err.message;
      $("agError").hidden = false;
      return;
    }
    dlg.close();
    playerFilter = "all"; // ať novou hru neschová zapnutý filtr
    try { await reload(); } catch (err) { toast(err.message); return; }
    toast(`„${name}“ je ve tvé sbírce.`);
    highlightGame(name);
  });
  dlg.showModal();
}

function openWishlist() {
  const dlg = $("dlgWishlist");
  $("wlName").value = ""; delete $("wlName").dataset.gameId;
  $("wlFile").value = "";
  $("wlError").hidden = true;
  $("formWishlist").onsubmit = withBusy($("formWishlist"), async () => {
    let game;
    try {
      game = await resolveGame($("wlName"));
      await api.addWishlist(game.id);
      const file = $("wlFile").files[0];
      if (file) await api.uploadImage(game.id, file);
    } catch (err) {
      $("wlError").textContent = err.message;
      $("wlError").hidden = false;
      return;
    }
    dlg.close();
    try { await reload(); } catch (err) { toast(err.message); return; }
    toast(`„${game.name}“ přidáno do hledáčku.`);
    highlightGame(game.name);
  });
  dlg.showModal();
}

function openPropose(date) {
  const dlg = $("dlgPropose");
  $("prTitle").textContent = `Navrhnout hru na ${fmtDate(date)}`;
  $("prName").value = ""; delete $("prName").dataset.gameId;
  $("prError").hidden = true;
  $("formPropose").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const game = await resolveGame($("prName"));
      await api.proposeGame(date, game.id);
      dlg.close();
      await reload();
      toast(`Návrh zapsán: ${game.name} (${me.initial}).`);
    } catch (err) {
      $("prError").textContent = err.message;
      $("prError").hidden = false;
    }
  };
  dlg.showModal();
}

function openRate(ev) {
  const dlg = $("dlgRate");
  $("rateTitle").textContent = `Jak bylo ${fmtDate(ev.event_date)}?`;
  const names = ev.games.filter((g) => g.kind === "played").map((g) => gameById(g.game_id)?.name).filter(Boolean);
  $("rateGames").textContent = names.join(" · ");
  const scale = $("rateScale");
  scale.textContent = "";
  const mine = ev.ratings.find((r) => r.member_id === me.id);
  for (let s = 1; s <= 10; s++) {
    scale.append(el("button", {
      type: "button",
      class: "rate-btn" + (mine?.score === s ? " rate-btn--on" : ""),
      text: s,
      onclick: async () => {
        try {
          await api.rateEvent(ev.id, s);
          dlg.close();
          await reload();
          toast(`Uloženo: ${s}/10.`);
        } catch (err) {
          $("rateError").textContent = err.message;
          $("rateError").hidden = false;
        }
      },
    }));
  }
  $("rateError").hidden = true;
  dlg.showModal();
}

function openGameEdit(g) {
  const dlg = $("dlgGameEdit");
  $("geTitle").textContent = g.name;
  $("geMin").value = g.min_players ?? "";
  $("geMax").value = g.max_players ?? "";
  $("geFile").value = "";
  $("geError").hidden = true;
  $("formGameEdit").onsubmit = withBusy($("formGameEdit"), async () => {
    try {
      const min = $("geMin").value ? +$("geMin").value : null;
      const max = $("geMax").value ? +$("geMax").value : null;
      if (min !== g.min_players || max !== g.max_players) await api.updateGamePlayers(g.id, min, max);
      const file = $("geFile").files[0];
      if (file) await api.uploadImage(g.id, file);
    } catch (err) {
      $("geError").textContent = err.message;
      $("geError").hidden = false;
      return;
    }
    dlg.close();
    try { await reload(); } catch (err) { toast(err.message); return; }
    toast("Uloženo.");
    highlightGame(g.name);
  });
  dlg.showModal();
}

function openProfile(firstLogin = false) {
  const dlg = $("dlgProfile");
  $("profFirst").hidden = !firstLogin;
  $("profPassword").required = firstLogin;
  $("profPassword").value = "";
  $("profQuestion").value = me.host_question ?? "";
  $("profAnswer").value = "";
  $("profError").hidden = true;
  $("formProfile").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const pw = $("profPassword").value;
      const q = $("profQuestion").value.trim();
      const a = $("profAnswer").value.trim();
      if (pw) await api.changePassword(pw);
      if (q && a) await api.setHostSecret(q, a);
      else if ((q && !a) || (!q && a)) throw new Error("Host otázka potřebuje otázku i odpověď.");
      dlg.close();
      await reload();
      toast("Profil uložen.");
    } catch (err) {
      $("profError").textContent = err.message;
      $("profError").hidden = false;
    }
  };
  dlg.showModal();
}

// ---------- Admin: editor termínu ----------

let evGames = []; // {gameId|null, name, note}

function renderEvGames() {
  const list = $("evGamesList");
  list.textContent = "";
  evGames.forEach((g, i) => {
    list.append(el("span", { class: "chip" }, [
      document.createTextNode(g.name + (g.note ? ` (${g.note})` : "")),
      el("button", { type: "button", class: "chip-x", text: "×", onclick: () => { evGames.splice(i, 1); renderEvGames(); } }),
    ]));
  });
}

function openEventEditor(ev) {
  const dlg = $("dlgEvent");
  $("evTitle").textContent = ev ? `Termín ${fmtDate(ev.event_date)}` : "Nový termín";
  $("evDate").value = ev ? ev.event_date : nextFridays(1)[0];
  $("evDate").disabled = !!ev;
  $("evNote").value = ev?.note ?? "";
  $("evGuests").value = ev ? ev.guests.join(", ") : "";
  $("evGameName").value = ""; $("evGameNote").value = "";
  evGames = ev
    ? ev.games.filter((g) => g.kind === "played").map((g) => ({ gameId: g.game_id, name: gameById(g.game_id)?.name ?? "?", note: g.note }))
    : [];
  renderEvGames();

  const parts = $("evParticipants");
  parts.textContent = "";
  for (const m of data.members) {
    const checked = ev ? ev.participants.includes(m.id) : false;
    const cb = el("input", { type: "checkbox", value: m.id });
    cb.checked = checked;
    parts.append(el("label", { class: "check" }, [cb, document.createTextNode(" " + m.display_name)]));
  }

  $("evGameAdd").onclick = () => {
    const name = $("evGameName").value.trim();
    if (!name) return;
    evGames.push({ gameId: $("evGameName").dataset.gameId || null, name, note: $("evGameNote").value.trim() || null });
    $("evGameName").value = ""; delete $("evGameName").dataset.gameId;
    $("evGameNote").value = "";
    renderEvGames();
  };

  $("evError").hidden = true;
  $("formEvent").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const playedGames = [];
      for (const g of evGames) {
        const game = g.gameId ? gameById(g.gameId) : await api.findOrCreateGame(g.name);
        playedGames.push({ gameId: game.id, note: g.note });
      }
      const participantIds = [...$("evParticipants").querySelectorAll("input:checked")].map((c) => c.value);
      const guests = $("evGuests").value.split(",").map((s) => s.trim()).filter(Boolean);
      await api.adminSaveEvent({
        eventId: ev?.id ?? null,
        date: $("evDate").value,
        note: $("evNote").value.trim() || null,
        playedGames, participantIds, guests,
      });
      dlg.close();
      await reload();
      toast("Termín uložen.");
    } catch (err) {
      $("evError").textContent = err.message;
      $("evError").hidden = false;
    }
  };
  dlg.showModal();
}

// ---------- Render ----------

function render() {
  renderLogin();
  renderActions();
  renderCalendar();
  renderGallery();
}

// ---------- Start ----------

(async function init() {
  document.querySelectorAll("dialog [data-close]").forEach((b) =>
    b.addEventListener("click", () => b.closest("dialog").close()));

  // na mobilu je kalendář sbalený, nadpis funguje jako přepínač
  document.querySelector(".rail-title").addEventListener("click", () =>
    $("calendarRail").classList.toggle("calendar--open"));

  try {
    api = await createApi();
    await api.init();
    await reload();
  } catch (err) {
    $("notice").textContent = "Web se nepodařilo načíst: " + err.message;
    $("notice").hidden = false;
    return;
  }

  if (api.mode === "demo") {
    $("notice").textContent = "Náhledový režim – ukázková data, bez přihlašování. Po připojení Supabase (js/config.js) bude web plně funkční.";
    $("notice").hidden = false;
    // jen pro náhled rozvržení v demo režimu: demoLoginAs('s') v konzoli
    window.demoLoginAs = (slug) => {
      me = data.members.find((m) => m.slug === slug) || null;
      render();
    };
  }

  attachSuggest($("agName"), $("agSuggest"));
  attachSuggest($("wlName"), $("wlSuggest"));
  attachSuggest($("prName"), $("prSuggest"));
  attachSuggest($("evGameName"), $("evSuggest"));
})();
