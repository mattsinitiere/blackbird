import { supabase } from "./supabase";

/**
 * Data access layer. Reads/writes the shared `players` and `matches` tables
 * in Supabase. Every authenticated user (your group) sees the same data.
 * Matches are inserted as individual rows, so two phones logging games at the
 * same time never overwrite each other.
 */

export async function getPlayers() {
  const { data, error } = await supabase
    .from("players")
    .select("username, created_at, hidden")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ username: r.username, createdAt: r.created_at, hidden: !!r.hidden }));
}

export async function addPlayer(username, hidden = false) {
  const { error } = await supabase.from("players").insert({ username, hidden });
  if (error) {
    if (error.code === "23505") return false; // duplicate username
    throw error;
  }
  return true;
}

export async function setPlayerHidden(username, hidden) {
  const { error } = await supabase.from("players").update({ hidden }).eq("username", username);
  if (error) throw error;
}

export async function getMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("completed_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    gameType: r.game_type,
    config: r.config || {},
    players: r.players,
    winner: r.winner,
    perPlayer: r.per_player,
    completedAt: r.completed_at,
  }));
}

export async function addMatch(m) {
  const { error } = await supabase.from("matches").insert({
    game_type: m.gameType,
    config: m.config || {},
    players: m.players,
    winner: m.winner,
    per_player: m.perPlayer,
    completed_at: m.completedAt,
  });
  if (error) throw error;
}
