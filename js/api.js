// Datová vrstva – jednotné rozhraní nad Supabase, s demo režimem
// (lokální data jen pro čtení), dokud není vyplněný js/config.js.

const CFG = window.APP_CONFIG || {};

export async function createApi() {
  if (CFG.supabaseUrl && CFG.supabaseAnonKey) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return new SupabaseApi(createClient(CFG.supabaseUrl, CFG.supabaseAnonKey));
  }
  return new DemoApi();
}

// ---------- Supabase ----------

class SupabaseApi {
  constructor(client) {
    this.sb = client;
    this.mode = "supabase";
    this.memberId = null;
  }

  async init() {
    const { data } = await this.sb.auth.getSession();
    if (data.session) await this.resolveMember();
  }

  async resolveMember() {
    const { data: userData } = await this.sb.auth.getUser();
    if (!userData?.user) { this.memberId = null; return; }
    const { data } = await this.sb.from("members").select("id").eq("auth_user_id", userData.user.id).single();
    this.memberId = data?.id ?? null;
  }

  getSessionMemberId() { return this.memberId; }

  async loadAll() {
    const authed = !!this.memberId;
    const queries = [
      this.sb.from("members").select("*").order("sort_order"),
      this.sb.from("games").select("*").order("name"),
      this.sb.from("game_owners").select("*"),
      this.sb.from("wishlist").select("*"),
      this.sb.from("events").select("*").order("event_date"),
      this.sb.from("event_games").select("*"),
      this.sb.from("ratings").select("*"),
      authed ? this.sb.from("event_participants").select("*") : Promise.resolve({ data: [] }),
    ];
    const [members, games, owners, wishlist, events, eventGames, ratings, participants] = await Promise.all(queries);
    for (const r of [members, games, owners, wishlist, events, eventGames, ratings]) {
      if (r.error) throw new Error("Načtení dat selhalo: " + r.error.message);
    }
    return normalize({
      members: members.data,
      games: games.data,
      owners: owners.data,
      wishlist: wishlist.data,
      events: events.data,
      eventGames: eventGames.data,
      ratings: ratings.data,
      participants: participants.data || [],
    });
  }

  async signIn(member, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email: member.login_email, password });
    if (error) throw new Error("Přihlášení se nepovedlo. Zkontroluj heslo.");
    await this.resolveMember();
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.memberId = null;
  }

  async changePassword(newPassword) {
    const { error } = await this.sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error("Změna hesla selhala: " + error.message);
    await this.sb.rpc("mark_password_set");
  }

  async setHostSecret(question, answer) {
    const { error } = await this.sb.rpc("set_host_secret", { p_question: question, p_answer: answer });
    if (error) throw new Error("Uložení host otázky selhalo: " + error.message);
  }

  async checkHostAnswer(slug, answer) {
    const { data, error } = await this.sb.rpc("check_host_answer", { p_member_slug: slug, p_answer: answer });
    if (error) throw new Error("Ověření selhalo: " + error.message);
    return !!data;
  }

  // Hry -----------------------------------------------------

  async findOrCreateGame(name, minPlayers = null, maxPlayers = null) {
    const { data: existing } = await this.sb.from("games").select("*").ilike("name", name.trim()).maybeSingle();
    if (existing) return existing;
    const { data, error } = await this.sb.from("games")
      .insert({ name: name.trim(), min_players: minPlayers, max_players: maxPlayers })
      .select().single();
    if (error) throw new Error("Založení hry selhalo: " + error.message);
    return data;
  }

  async addGame({ name, minPlayers, maxPlayers, file }) {
    const game = await this.findOrCreateGame(name, minPlayers, maxPlayers);
    await this.addOwner(game.id);
    if (minPlayers || maxPlayers) {
      await this.sb.from("games").update({ min_players: minPlayers, max_players: maxPlayers }).eq("id", game.id);
    }
    if (file) await this.uploadImage(game.id, file);
    return game;
  }

  async updateGamePlayers(gameId, minPlayers, maxPlayers) {
    const { error } = await this.sb.from("games")
      .update({ min_players: minPlayers, max_players: maxPlayers }).eq("id", gameId);
    if (error) throw new Error("Úprava hry selhala: " + error.message);
  }

  async uploadImage(gameId, file) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${gameId}-${Date.now()}.${ext}`;
    const { error } = await this.sb.storage.from("game-images").upload(path, file, { upsert: true });
    if (error) throw new Error("Nahrání fotky selhalo: " + error.message);
    const { data } = this.sb.storage.from("game-images").getPublicUrl(path);
    const { error: upErr } = await this.sb.from("games").update({ image_path: data.publicUrl }).eq("id", gameId);
    if (upErr) throw new Error("Uložení fotky ke hře selhalo: " + upErr.message);
  }

  async addOwner(gameId) {
    const { error } = await this.sb.from("game_owners")
      .upsert({ game_id: gameId, member_id: this.memberId }, { onConflict: "game_id,member_id" });
    if (error) throw new Error("Uložení vlastnictví selhalo: " + error.message);
  }

  // Hledáček ------------------------------------------------

  async addWishlist(gameId) {
    const { error } = await this.sb.from("wishlist")
      .upsert({ member_id: this.memberId, game_id: gameId }, { onConflict: "member_id,game_id" });
    if (error) throw new Error("Přidání do hledáčku selhalo: " + error.message);
  }

  async removeWishlist(gameId) {
    const { error } = await this.sb.from("wishlist").delete()
      .eq("member_id", this.memberId).eq("game_id", gameId);
    if (error) throw new Error("Odebrání z hledáčku selhalo: " + error.message);
  }

  // Kalendář ------------------------------------------------

  async ensureEvent(dateStr) {
    const { data: existing } = await this.sb.from("events").select("id").eq("event_date", dateStr).maybeSingle();
    if (existing) return existing.id;
    const { data, error } = await this.sb.from("events").insert({ event_date: dateStr }).select("id").single();
    if (error) throw new Error("Založení termínu selhalo: " + error.message);
    return data.id;
  }

  async proposeGame(dateStr, gameId) {
    const eventId = await this.ensureEvent(dateStr);
    const { error } = await this.sb.from("event_games")
      .insert({ event_id: eventId, game_id: gameId, kind: "proposal", proposed_by: this.memberId });
    if (error) throw new Error("Uložení návrhu selhalo: " + error.message);
  }

  async removeProposal(eventGameId) {
    const { error } = await this.sb.from("event_games").delete().eq("id", eventGameId);
    if (error) throw new Error("Smazání návrhu selhalo: " + error.message);
  }

  async confirmAttendance(dateStr) {
    const eventId = await this.ensureEvent(dateStr);
    const { error } = await this.sb.from("event_participants")
      .upsert({ event_id: eventId, member_id: this.memberId }, { onConflict: "event_id,member_id" });
    if (error) throw new Error("Potvrzení účasti selhalo: " + error.message);
  }

  async rateEvent(eventId, score) {
    const { error } = await this.sb.from("ratings")
      .upsert({ event_id: eventId, member_id: this.memberId, score }, { onConflict: "event_id,member_id" });
    if (error) throw new Error("Uložení hodnocení selhalo: " + error.message);
  }

  // Admin ---------------------------------------------------

  async adminSaveEvent({ date, note, playedGames, participantIds, guests, eventId }) {
    let id = eventId;
    if (!id) {
      // termín pro dané datum už mohl vzniknout návrhem hry od člena
      const { data: existing } = await this.sb.from("events").select("id").eq("event_date", date).maybeSingle();
      id = existing?.id ?? null;
    }
    if (!id) {
      const { data, error } = await this.sb.from("events").insert({ event_date: date, note }).select("id").single();
      if (error) throw new Error("Založení termínu selhalo: " + error.message);
      id = data.id;
    } else {
      await this.sb.from("events").update({ note }).eq("id", id);
      await this.sb.from("event_games").delete().eq("event_id", id).eq("kind", "played");
      await this.sb.from("event_participants").delete().eq("event_id", id);
    }
    if (playedGames.length) {
      const rows = playedGames.map((g) => ({ event_id: id, game_id: g.gameId, kind: "played", note: g.note || null }));
      const { error } = await this.sb.from("event_games").insert(rows);
      if (error) throw new Error("Uložení her selhalo: " + error.message);
    }
    const partRows = participantIds.map((m) => ({ event_id: id, member_id: m }))
      .concat(guests.map((g) => ({ event_id: id, guest_name: g })));
    if (partRows.length) {
      const { error } = await this.sb.from("event_participants").insert(partRows);
      if (error) throw new Error("Uložení účastníků selhalo: " + error.message);
    }
  }
}

// ---------- Demo režim (jen pro čtení) ----------

const DEMO_MSG = "Demo režim – data jsou jen ukázková. Po připojení Supabase (js/config.js) bude vše funkční.";

class DemoApi {
  constructor() {
    this.mode = "demo";
    this.memberId = null;
  }

  async init() {}
  getSessionMemberId() { return null; }

  async loadAll() {
    const d = window.DEMO_DATA;
    const members = d.members.map((m) => ({ ...m, login_email: null }));
    const bySlug = Object.fromEntries(members.map((m) => [m.slug, m]));
    const games = d.games.map(([name, min, max, file, owners], i) => ({
      id: "game-" + i,
      name,
      min_players: min,
      max_players: max,
      image_path: "assets/games/" + file,
      _owners: owners.map((s) => bySlug[s].id),
    }));
    const byName = Object.fromEntries(games.map((g) => [g.name, g]));
    const owners = games.flatMap((g) => g._owners.map((m) => ({ game_id: g.id, member_id: m })));
    const events = d.events.map((e, i) => ({ id: "event-" + i, event_date: e.date, note: null }));
    const eventGames = d.events.flatMap((e, i) =>
      e.games.map(([name, note], j) => ({
        id: `eg-${i}-${j}`, event_id: "event-" + i, game_id: byName[name].id,
        kind: "played", proposed_by: null, note,
      })));
    const participants = d.events.flatMap((e, i) =>
      e.participants.map((s) => ({ event_id: "event-" + i, member_id: bySlug[s].id, guest_name: null }))
        .concat(e.guests.map((g) => ({ event_id: "event-" + i, member_id: null, guest_name: g }))));
    const wishlist = d.wishlist.map(([slug, name]) => ({ member_id: bySlug[slug].id, game_id: byName[name].id }));
    return normalize({ members, games, owners, wishlist, events, eventGames, ratings: [], participants });
  }

  async signIn() { throw new Error(DEMO_MSG); }
  async signOut() {}
  async checkHostAnswer() { throw new Error(DEMO_MSG); }
}
["changePassword", "setHostSecret", "findOrCreateGame", "addGame", "updateGamePlayers", "uploadImage",
 "addOwner", "addWishlist", "removeWishlist", "ensureEvent", "proposeGame", "removeProposal",
 "confirmAttendance", "rateEvent", "adminSaveEvent"].forEach((fn) => {
  DemoApi.prototype[fn] = async () => { throw new Error(DEMO_MSG); };
});

// ---------- Normalizace do tvaru pro UI ----------

function normalize({ members, games, owners, wishlist, events, eventGames, ratings, participants }) {
  const gamesById = new Map(games.map((g) => [g.id, { ...g, owners: [] }]));
  for (const o of owners) gamesById.get(o.game_id)?.owners.push(o.member_id);

  const eventsById = new Map(events.map((e) => [e.id, { ...e, games: [], participants: [], guests: [], ratings: [] }]));
  for (const eg of eventGames) eventsById.get(eg.event_id)?.games.push(eg);
  for (const p of participants) {
    const e = eventsById.get(p.event_id);
    if (!e) continue;
    if (p.member_id) e.participants.push(p.member_id);
    else if (p.guest_name) e.guests.push(p.guest_name);
  }
  for (const r of ratings) eventsById.get(r.event_id)?.ratings.push(r);

  return {
    members,
    games: [...gamesById.values()],
    events: [...eventsById.values()].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    wishlist,
  };
}
