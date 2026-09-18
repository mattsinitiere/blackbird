import { supabase } from "./supabase";
import { BASE_ELO } from "./constants";
import { buildResultRows, humanPlayers } from "./practice";

/**
 * Data access layer for the shared `players` and `game_results` tables.
 * Per-player scoring: each game writes one row per participant, and each
 * player's current Elo is stored on their players row.
 */

// column sets, newest first; older databases that haven't run every
// migration fall back to the next one down
const PLAYER_SELECTS = [
  "username, created_at, hidden, elo, color, auth_id, handle, bio, location",
  "username, created_at, hidden, elo, color, auth_id",
  "username, created_at, hidden, elo, color",
];

export async function getPlayers() {
  let data = null;
  let error = null;
  for (const cols of PLAYER_SELECTS) {
    ({ data, error } = await supabase.from("players").select(cols).order("created_at", { ascending: true }));
    if (!error) break;
  }
  if (error) throw error;
  return data.map((r) => ({
    username: r.username,
    createdAt: r.created_at,
    hidden: !!r.hidden,
    elo: r.elo == null ? BASE_ELO : Number(r.elo),
    color: r.color || null,
    authId: r.auth_id || null,
    handle: r.handle || null,
    bio: r.bio || "",
    location: r.location || "",
  }));
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
export async function updatePlayerProfile(username, { handle, bio, location }) {
  const patch = {};
  if (handle !== undefined) patch.handle = handle || null;
  if (bio !== undefined) patch.bio = bio || null;
  if (location !== undefined) patch.location = location || null;
  const { error } = await supabase.from("players").update(patch).eq("username", username);
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, reason: "That handle is taken." };
  if (error.code === "23514") return { ok: false, reason: "That doesn't fit the handle rules." };
  if (error.code === "42501") return { ok: false, reason: "Only the profile owner can edit this." };
  if (error.code === "42703") return { ok: false, reason: "Profiles aren't enabled on this database yet." };
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

export async function getGameResults() {
  const { data, error } = await supabase
    .from("game_results")
    .select("*")
    .order("completed_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    gameId: r.game_id,
    username: r.username,
    gameType: r.game_type,
    config: r.config || {},
    winner: r.winner,
    result: r.result,
    opponents: r.opponents || [],
    stats: r.stats || {},
    eloAfter: r.elo_after == null ? BASE_ELO : Number(r.elo_after),
    completedAt: r.completed_at,
  }));
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
    if (insErr) throw insErr;
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
