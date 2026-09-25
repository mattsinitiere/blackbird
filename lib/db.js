import { supabase } from "./supabase";
import { BASE_ELO } from "./constants";
import { buildResultRows, humanPlayers, resultFromRow } from "./practice";
import { finishPlaces } from "./summary";
import { paginate, supabasePager } from "./data/paginate.js";

/**
 * Data access layer for the shared `players` and `game_results` tables.
 * Per-player scoring: each game writes one row per participant, and each
 * player's current Elo is stored on their players row.
 */

export { PLAYER_SELECTS, playerFromRow } from "./playerRow.js";
import { PLAYER_SELECTS, playerFromRow } from "./playerRow.js";

export async function getPlayers() {
  let data = null;
  let error = null;
  for (const cols of PLAYER_SELECTS) {
    ({ data, error } = await supabase.from("players").select(cols).order("created_at", { ascending: true }));
    if (!error) break;
  }
  if (error) throw error;
  return data.map(playerFromRow);
}

/**
 * Follows visible to the caller: their own (who they follow) and the
 * follows of their own player row (their followers). Resolves to null when
 * the follows table does not exist yet (migration-follows-tags.sql not
 * run), so the app can fall back to "everyone".
 */
export async function getFollows() {
  const { data, error } = await supabase.from("follows").select("follower, followed, created_at");
  if (error) {
    if (error.code === "42P01" || /follows/.test(error.message || "")) return null;
    throw error;
  }
  return (data || []).map((r) => ({ follower: r.follower, followed: r.followed, createdAt: r.created_at }));
}

/** Follow a player row. Already following counts as success. */
export async function followPlayer(followerId, playerId) {
  const { error } = await supabase.from("follows").insert({ follower: followerId, followed: playerId });
  if (!error || error.code === "23505") return { ok: true };
  if (error.code === "42501") return { ok: false, reason: "You can't follow that player." };
  return { ok: false, reason: error.message || "Couldn't follow." };
}

export async function unfollowPlayer(followerId, playerId) {
  const { error } = await supabase.from("follows").delete().eq("follower", followerId).eq("followed", playerId);
  if (error) return { ok: false, reason: error.message || "Couldn't unfollow." };
  return { ok: true };
}

export async function addPlayer(username, hidden = false, authId = null, handle = null) {
  const row = { username, hidden, elo: BASE_ELO };
  if (authId) row.auth_id = authId;
  if (handle) row.handle = handle;
  let { error } = await supabase.from("players").insert(row);
  if (error && handle && (error.code === "23505" || error.code === "42703") && !/username/.test(error.message || "")) {
    // handle taken (or column missing on an old database): keep the player, drop the handle
    delete row.handle;
    ({ error } = await supabase.from("players").insert(row));
  }
  if (error) {
    if (error.code === "23505") return false; // duplicate username
    throw error;
  }
  return true;
}

/**
 * Edit the owner-only profile fields. Resolves to { ok: true } or
 * { ok: false, reason } for a taken/invalid handle or a permission error.
 */
export async function updatePlayerProfile(username, { handle, bio, location, tag, tagIcon, cover }) {
  const patch = {};
  if (handle !== undefined) patch.handle = handle || null;
  if (bio !== undefined) patch.bio = bio || null;
  if (location !== undefined) patch.location = location || null;
  if (tag !== undefined) patch.tag = tag || null;
  if (tagIcon !== undefined) patch.tag_icon = tagIcon || null;
  if (cover !== undefined) patch.cover = cover || null;
  const { error } = await supabase.from("players").update(patch).eq("username", username);
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, reason: "That handle is taken." };
  if (error.code === "23514") return { ok: false, reason: /tag/.test(error.message || "") ? "That doesn't fit the tag rules." : "That doesn't fit the handle rules." };
  if (error.code === "42501") return { ok: false, reason: "Only the profile owner can edit this." };
  if (error.code === "42703" && /cover/.test(error.message || "")) return { ok: false, reason: "Profile covers aren't enabled on this database yet (run migration-tag-icons-covers.sql)." };
  if (error.code === "42703") return { ok: false, reason: /tag/.test(error.message || "") ? "Name tags aren't enabled on this database yet (run migration-follows-tags.sql)." : "Profiles aren't enabled on this database yet." };
  return { ok: false, reason: error.message || "Couldn't save." };
}

/** True when no other player holds this handle (case-insensitive). */
export async function isHandleAvailable(handle, exceptUsername = null) {
  if (!supabase) return true;
  const { data, error } = await supabase.from("players").select("username").ilike("handle", handle).limit(1);
  if (error) return true; // old database: let the write decide
  if (!data || data.length === 0) return true;
  return data[0].username === exceptUsername;
}

export async function linkPlayerAuth(username, authId) {
  const { error } = await supabase.from("players").update({ auth_id: authId }).eq("username", username);
  if (error && !error.message?.includes("auth_id")) throw error;
}

export async function setPlayerHidden(username, hidden) {
  const { error } = await supabase.from("players").update({ hidden }).eq("username", username);
  if (error) throw error;
}

export async function setPlayerColor(username, color) {
  const { error } = await supabase.from("players").update({ color }).eq("username", username);
  if (error) throw error;
}

/**
 * Every result row this user may read, oldest first. Walks the table in
 * keyset pages (lib/data/paginate.js): a single select used to stop at the
 * server's row cap (1000) without saying so. `coverage` on the returned
 * array says whether the walk completed.
 */
export async function getGameResults() {
  const page = await paginate(supabasePager(() => supabase.from("game_results").select("*")));
  const rows = page.rows.map((r) => resultFromRow(r, BASE_ELO));
  rows.coverage = { status: page.status, reason: page.reason, asOf: page.asOf, rows: rows.length };
  return rows;
}

/**
 * Record one finished game: insert a result row for each real player and,
 * for ranked games, write back their new Elo. `eloAfter` is a map
 * { username: newRating } (ranked only); `currentElo` is the ratings map
 * before the game, stored unchanged on practice rows. Bots never get a row.
 */
export async function recordGame({ gameId, gameType, config, players, winner, perPlayer, ranked = true, eloAfter, currentElo, completedAt }) {
  const rows = buildResultRows({
    gameId,
    gameType,
    config,
    players,
    winner,
    perPlayer,
    ranked,
    eloAfter,
    currentElo,
    completedAt,
    // finishing order, so multiplayer standings are stored, not re-derived
    places: (players || []).length > 1 ? finishPlaces({ gameType, config, players, winner, perPlayer }) : null,
    baseElo: BASE_ELO,
  });

  // a retried save (network dropped mid-way) must not insert the game twice
  const { data: existing, error: selErr } = await supabase
    .from("game_results")
    .select("game_id")
    .eq("game_id", gameId)
    .limit(1);
  if (selErr) throw selErr;
  if (!existing || existing.length === 0) {
    const { error: insErr } = await supabase.from("game_results").insert(rows);
    // 23505: the game was already saved by a retry the caller cannot read
    // (result rows are visible only to participants who follow each other)
    if (insErr && insErr.code !== "23505") throw insErr;
  }

  if (!ranked) return;
  for (const u of humanPlayers(players)) {
    const { error: updErr } = await supabase
      .from("players")
      .update({ elo: Math.round(eloAfter[u]) })
      .eq("username", u);
    if (updErr) throw updErr;
  }
}

/** Stored rows for one game (only those this user may read), for late syncs. */
export async function getGameRowsForSync(gameId) {
  const { data, error } = await supabase.from("game_results").select("username, elo_after").eq("game_id", gameId);
  if (error) throw error;
  return data || [];
}

/** Current server Elo for some players: { username: elo }. */
export async function getEloFor(usernames) {
  const out = {};
  if (!usernames?.length) return out;
  const { data, error } = await supabase.from("players").select("username, elo").in("username", usernames);
  if (error) throw error;
  for (const u of usernames) out[u] = BASE_ELO;
  for (const p of data || []) out[p.username] = p.elo == null ? BASE_ELO : Number(p.elo);
  return out;
}

/** The signed-in user's own activity events (achievements). [] if unavailable. */
export async function getMyEvents() {
  const { data, error } = await supabase.from("player_events").select("kind, detail, day, created_at").order("day", { ascending: true });
  if (error) return [];
  return data || [];
}

/** Log events for the signed-in user; repeats of the same kind/detail/day are ignored. */
export async function recordEvents(events) {
  if (!events?.length) return;
  await supabase.from("player_events").upsert(events.map((e) => ({ kind: e.kind, detail: e.detail || "", day: e.day })), { onConflict: "auth_id,kind,detail,day", ignoreDuplicates: true });
}
