import { BASE_ELO } from "./constants.js";
import { buildResultRows, humanPlayers, isRankedMatch } from "./practice.js";
import { applyEloUpdate } from "./stats.js";
import { finishPlaces } from "./summary.js";

/**
 * Server-side plan for saving one finished game (app/api/record-game).
 * The browser can no longer write game_results or anyone's Elo, so this
 * decides what gets written: it checks the caller played in the game (or
 * is the admin), works out ranked/practice itself, and computes Elo from
 * the ratings stored in the database, never from numbers the client sent.
 * Pure — the route does the reads and writes.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PLAYERS = 8;
const MAX_JSON = 200_000; // config + perPlayer, serialised

/**
 * Validate the request body. Resolves to { ok: true, match } or
 * { ok: false, error }.
 */
export function parseGameSave(body) {
  const b = body || {};
  const { gameId, gameType, config = {}, players, winner = null, perPlayer = {}, completedAt } = b;
  if (typeof gameId !== "string" || !UUID.test(gameId)) return { ok: false, error: "Bad game id." };
  if (typeof gameType !== "string" || !gameType || gameType.length > 40) return { ok: false, error: "Bad game type." };
  if (!Array.isArray(players) || players.length < 1 || players.length > MAX_PLAYERS) return { ok: false, error: "Bad player list." };
  if (players.some((p) => typeof p !== "string" || !p.trim() || p.length > 60)) return { ok: false, error: "Bad player list." };
  if (new Set(players).size !== players.length) return { ok: false, error: "A player is listed twice." };
  if (winner !== null && !players.includes(winner)) return { ok: false, error: "The winner isn't in this game." };
  if (!config || typeof config !== "object" || Array.isArray(config)) return { ok: false, error: "Bad game settings." };
  if (!perPlayer || typeof perPlayer !== "object" || Array.isArray(perPlayer)) return { ok: false, error: "Bad game stats." };
  if (JSON.stringify(config).length + JSON.stringify(perPlayer).length > MAX_JSON) return { ok: false, error: "Game data is too large." };
  const when = new Date(completedAt);
  if (typeof completedAt !== "string" || Number.isNaN(when.getTime())) return { ok: false, error: "Bad finish time." };
  // offline games sync late, so the past is fine; the future is not
  if (when.getTime() > Date.now() + 5 * 60 * 1000) return { ok: false, error: "Finish time is in the future." };
  return { ok: true, match: { gameId, gameType, config, players, winner, perPlayer, completedAt: when.toISOString() } };
}

/**
 * Rows to insert and Elo to write for a validated match.
 *   callerUsername  the caller's own player row name (null if they have none)
 *   isAdmin         the admin may save any game
 *   knownPlayers    usernames that exist in the players table
 *   currentElo      { username: elo } from the database
 * Resolves to { ok: true, rows, elo } (elo is null for practice) or
 * { ok: false, error, status }.
 */
export function planGameSave({ match, callerUsername, isAdmin = false, knownPlayers, currentElo = {} }) {
  const humans = humanPlayers(match.players);
  if (!isAdmin && (!callerUsername || !humans.includes(callerUsername))) {
    return { ok: false, status: 403, error: "You can only save games you played in." };
  }
  const known = new Set(knownPlayers || []);
  const missing = humans.filter((u) => !known.has(u));
  if (missing.length) return { ok: false, status: 400, error: `Unknown player: ${missing.join(", ")}.` };

  const ranked = isRankedMatch(match);
  if (ranked && !match.winner) return { ok: false, status: 400, error: "A ranked game needs a winner." };
  const before = {};
  for (const u of humans) before[u] = currentElo[u] == null ? BASE_ELO : Number(currentElo[u]);
  const eloAfter = ranked ? applyEloUpdate(before, match.players, match.winner) : null;

  const rows = buildResultRows({
    ...match,
    ranked,
    eloAfter,
    currentElo: before,
    places: match.players.length > 1 ? finishPlaces(match) : null,
    baseElo: BASE_ELO,
  });
  const elo = ranked ? Object.fromEntries(humans.map((u) => [u, Math.round(eloAfter[u])])) : null;
  return { ok: true, rows, elo };
}
