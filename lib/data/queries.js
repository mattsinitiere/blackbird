/**
 * Targeted reads of game_results. Filters go into the query (who, which
 * mode, which dates, ranked or practice, one game), so the database does
 * the narrowing and only what a question needs comes back. Every query runs
 * with the caller's own Supabase client, so row-level security still
 * decides what they may see (their own rows plus players they follow).
 *
 * Detailed dart logs live in `stats`. Use FULL only where logs or per-game
 * stats are needed (analysis, summaries, profiles); LIGHT has no stats.
 */

import { paginate, supabasePager } from "./paginate.js";
import { buildCoverage } from "./coverage.js";
import { resultFromRow } from "../practice.js";
import { BASE_ELO } from "../constants.js";

export const FULL = "id, game_id, username, game_type, config, winner, result, opponents, stats, elo_after, completed_at";
export const LIGHT = "id, game_id, username, game_type, config, winner, result, opponents, elo_after, completed_at";

/**
 * A factory for the filtered base query (paginate adds cursor/order/limit).
 * @param {object} sb  a supabase-js client authenticated as the user
 * @param {object} f   { columns, username, usernames, gameType, gameTypes, gameId,
 *                       from, to (Date|ISO, [from, to)), result, ranked, includePractice, opponent }
 */
export function resultQuery(sb, f = {}) {
  return () => {
    let q = sb.from("game_results").select(f.columns || FULL);
    if (f.username) q = q.eq("username", f.username);
    if (f.usernames?.length) q = q.in("username", f.usernames);
    if (f.gameId) q = q.eq("game_id", f.gameId);
    if (f.gameType) q = q.eq("game_type", f.gameType);
    if (f.gameTypes?.length) q = q.in("game_type", f.gameTypes);
    if (f.from) q = q.gte("completed_at", new Date(f.from).toISOString());
    if (f.to) q = q.lt("completed_at", new Date(f.to).toISOString());
    if (f.result) q = q.eq("result", f.result);
    else if (f.ranked) q = q.in("result", ["win", "loss"]);
    else if (f.includePractice === false) q = q.neq("result", "practice");
    // opponents is a jsonb array: "contains this name"
    if (f.opponent) q = q.filter("opponents", "cs", JSON.stringify([f.opponent]));
    return q;
  };
}

/** Filters worth echoing in coverage (no clients, no column lists). */
function publicFilters(f) {
  const out = {};
  for (const k of ["username", "usernames", "gameType", "gameTypes", "gameId", "result", "ranked", "includePractice", "opponent"]) if (f[k] != null) out[k] = f[k];
  if (f.from) out.from = new Date(f.from).toISOString();
  if (f.to) out.to = new Date(f.to).toISOString();
  return out;
}

/**
 * Fetch matching rows (camelCase, lib/practice.js resultFromRow), oldest
 * first, with a coverage report.
 * @param {object} opts  paginate options: { newest: N } for the latest N only, asOf, bounds
 */
export async function fetchResults(sb, f = {}, opts = {}) {
  const newest = opts.newest != null ? Math.max(0, opts.newest | 0) : null;
  const page = await paginate(supabasePager(resultQuery(sb, f)), { ...opts, desc: newest != null, limit: newest ?? opts.limit });
  const raw = newest != null ? page.rows.slice().reverse() : page.rows;
  const rows = raw.map((r) => resultFromRow(r, BASE_ELO));
  const coverage = buildCoverage({
    requested: opts.requested || null,
    filters: publicFilters(f),
    page,
    rows,
    hasStats: !f.columns || /\bstats\b/.test(f.columns),
    sample: newest != null ? `newest ${newest}` : null,
  });
  return { rows, coverage };
}

/** Every row of one game the user may see. */
export async function fetchGame(sb, gameId) {
  return fetchResults(sb, { gameId }, { requested: `game ${gameId}` });
}
