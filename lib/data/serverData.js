/**
 * Server-side reads for Blackbird AI, run as the signed-in user (their JWT,
 * so row-level security applies). Who "me" is comes from the session:
 * players.auth_id = the auth user's id. Names or summaries sent by the
 * browser are never used to decide whose data to read.
 */

import { fetchResults, LIGHT } from "./queries.js";
import { PLAYER_SELECTS, playerFromRow } from "../playerRow.js";
import { computeStats, eloMapFromPlayers } from "../stats.js";
import { followsForSocial, followingUsernames, circlePlayers } from "../follows.js";
import { activityFromEvents } from "../playerEvents.js";
import { buildMySummary } from "../aiSummary.js";

export class NotLinkedError extends Error {
  constructor() {
    super("Your account isn't linked to a player yet. Play a game or open your profile, then try again.");
    this.status = 409;
  }
}

/** All players (the roster is readable by every member), newest schema first. */
export async function loadPlayers(sb) {
  let data = null;
  let error = null;
  for (const cols of PLAYER_SELECTS) {
    ({ data, error } = await sb.from("players").select(cols).order("created_at", { ascending: true }).limit(5000));
    if (!error) break;
  }
  if (error) throw error;
  return (data || []).map(playerFromRow);
}

/** The caller's own player row, from their auth id. Throws NotLinkedError. */
export function myPlayerFrom(players, userId) {
  const mine = (players || []).find((p) => p.authId && p.authId === userId);
  if (!mine) throw new NotLinkedError();
  return mine;
}

async function loadFollows(sb) {
  const { data, error } = await sb.from("follows").select("follower, followed, created_at");
  if (error) return null;
  return (data || []).map((r) => ({ follower: r.follower, followed: r.followed, createdAt: r.created_at }));
}

async function loadEvents(sb) {
  const { data, error } = await sb.from("player_events").select("kind, detail, day, created_at").order("day", { ascending: true }).limit(5000);
  if (error) return [];
  return data || [];
}

/**
 * Everything buildMySummary needs, fetched with targeted queries:
 * - the caller's own rows in full (their stats and dart logs)
 * - light rows (no stats) for the rest of their circle, only to rank them
 * - the roster, their follows and their own activity events
 * Returns the summary plus coverage for the rows it was built from.
 */
export async function buildServerSummary(sb, { userId, now = new Date() }) {
  const players = await loadPlayers(sb);
  const mine = myPlayerFrom(players, userId);
  const me = mine.username;
  const [own, circle, follows, events] = await Promise.all([
    fetchResults(sb, { username: me }, { requested: "your full history" }),
    fetchResults(sb, { columns: LIGHT, includePractice: false }, { requested: "circle standings" }),
    loadFollows(sb),
    loadEvents(sb),
  ]);
  const practice = own.rows.filter((r) => r.result === "practice");
  const results = [...own.rows.filter((r) => r.result !== "practice"), ...circle.rows.filter((r) => r.username !== me)];
  const following = follows === null ? null : followingUsernames(follows, players, userId);
  const roster = circlePlayers(players, following, me);
  const social = { ...followsForSocial(follows, players, { myAuthId: userId, myPlayerId: mine.id }), activity: activityFromEvents(events) };
  const stats = computeStats(results);
  const elo = eloMapFromPlayers(players);
  const summary = buildMySummary({ me, stats, elo, results, practice, players: roster, social, now });
  summary.coverage = { games: own.coverage, circle: { status: circle.coverage.status, rowsRetrieved: circle.coverage.rowsRetrieved } };
  return { me, player: mine, players: roster, summary, coverage: own.coverage };
}
