/**
 * Renaming a player everywhere their name is stored. Results are keyed by
 * username (text), so a rename has to reach every copy of the name:
 *
 * - players.username
 * - game_results: username, winner, opponents, and names inside stats
 *   (Killer and Gotcha event logs record who hit whom)
 * - matches (legacy): players, winner, and the per_player map
 *
 * Used by the admin Rename action and by account deletion, which renames
 * the player to "Deleted player …". Server-only: needs the service-role
 * client, since members can't write other players' rows.
 */

const PAGE = 1000;
const CHUNK = 100;

/**
 * A copy of `value` with every string equal to `from` (and every object key
 * equal to `from`) replaced by `to`. Returns the same reference when nothing
 * changed, so callers can skip no-op updates.
 */
export function replaceName(value, from, to) {
  if (typeof value === "string") return value === from ? to : value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = replaceName(v, from, to);
      if (n !== v) changed = true;
      return n;
    });
    return changed ? out : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const key = k === from ? to : k;
      const n = replaceName(v, from, to);
      if (key !== k || n !== v) changed = true;
      out[key] = n;
    }
    return changed ? out : value;
  }
  return value;
}

/**
 * Dart logs inside stats hold tokens like "T20", "D16", "Bull" or "Miss". A
 * player literally named like a dart would collide with them, so for those
 * names stats are left alone (the top-level columns are still renamed).
 */
const DART_TOKEN = /^([SDT]?\d{1,2}|bull|sb|db|miss|m)$/i;

/** Every row a query returns, a page at a time. `build` returns a fresh query. */
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Rename `oldName` to `newName` in players, game_results and matches. The
 * caller checks that `newName` is free. Safe to run again after a partial
 * failure: rows already renamed are simply found under the new name.
 */
export async function renamePlayerEverywhere(admin, oldName, newName) {
  const { error: e1 } = await admin.from("players").update({ username: newName }).eq("username", oldName);
  if (e1) throw e1;

  // every result row that can mention the name: all rows of the player's own
  // games (their opponents' rows included), plus any stray row naming them
  const own = await fetchAll(() => admin.from("game_results").select("game_id").eq("username", oldName));
  const gameIds = [...new Set(own.map((r) => r.game_id))];
  const byId = new Map();
  const collect = (rows) => rows.forEach((r) => byId.set(r.id, r));
  const COLS = "id, username, winner, opponents, stats";
  for (let i = 0; i < gameIds.length; i += CHUNK) {
    const ids = gameIds.slice(i, i + CHUNK);
    collect(await fetchAll(() => admin.from("game_results").select(COLS).in("game_id", ids)));
  }
  collect(await fetchAll(() => admin.from("game_results").select(COLS).eq("winner", oldName)));
  collect(await fetchAll(() => admin.from("game_results").select(COLS).contains("opponents", JSON.stringify([oldName]))));

  for (const row of byId.values()) {
    const upd = {};
    for (const col of DART_TOKEN.test(oldName) ? ["username", "winner", "opponents"] : ["username", "winner", "opponents", "stats"]) {
      const next = replaceName(row[col], oldName, newName);
      if (next !== row[col]) upd[col] = next;
    }
    if (Object.keys(upd).length === 0) continue;
    const { error } = await admin.from("game_results").update(upd).eq("id", row.id);
    if (error) throw error;
  }

  const matchRows = await fetchAll(() => admin.from("matches").select("id, players, winner, per_player").contains("players", JSON.stringify([oldName])));
  for (const row of matchRows) {
    const upd = {};
    for (const col of ["players", "winner", "per_player"]) {
      const next = replaceName(row[col], oldName, newName);
      if (next !== row[col]) upd[col] = next;
    }
    if (Object.keys(upd).length === 0) continue;
    const { error } = await admin.from("matches").update(upd).eq("id", row.id);
    if (error) throw error;
  }
}
