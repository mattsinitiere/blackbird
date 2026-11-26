import { gameTitle } from "./summary.js";
import { playerLabel } from "./bots.js";

/**
 * The game in progress, as the shell keeps it on this device so a reload
 * (or the phone killing the tab) doesn't lose the leg. Pure helpers: the
 * shell does the localStorage reads and writes.
 *
 * Undo survives a reload too. Each undo step is a full snapshot of the
 * game state, so the history grows quickly over a long leg; only the most
 * recent steps are kept, and fewer when the save would get too big.
 */

export const LIVE_KEY = "bb-live-game";
/** Undo steps kept across a reload (about three rounds of two players). */
export const LIVE_UNDO_STEPS = 10;
/** Upper bound for the saved string, well inside a 5 MB localStorage. */
export const LIVE_MAX_CHARS = 1_000_000;

/** The progress snapshot with its undo history cut to the last `steps`. */
export function capHistory(progress, steps = LIVE_UNDO_STEPS) {
  if (!progress || typeof progress !== "object" || !Array.isArray(progress.history)) return progress;
  if (progress.history.length <= steps) return progress;
  return { ...progress, history: steps > 0 ? progress.history.slice(-steps) : [] };
}

/**
 * The string to store for a live game: as many recent undo steps as fit
 * under `maxChars` (halving until it does, then none at all).
 */
export function serializeLive({ userId, game, progress }, { steps = LIVE_UNDO_STEPS, maxChars = LIVE_MAX_CHARS } = {}) {
  let n = steps;
  for (;;) {
    const out = JSON.stringify({ userId, game, progress: capHistory(progress, n) });
    if (out.length <= maxChars || n === 0) return out;
    n = n > 1 ? Math.floor(n / 2) : 0;
  }
}

/** The saved live game for this account, or null (missing, broken, or someone else's). */
export function parseLive(raw, userId) {
  if (!raw || !userId) return null;
  try {
    const { userId: owner, game, progress } = JSON.parse(raw);
    if (owner !== userId) return null; // someone else's leg on a shared device
    if (!game || !game.gameType || !Array.isArray(game.players)) return null;
    return { game, progress: progress || null };
  } catch {
    return null;
  }
}

/**
 * Starting `next` while `live` is still being played needs the player's
 * say-so. Resuming the very same game (same id) does not.
 */
export function needsReplaceConfirm(live, next) {
  if (!live) return false;
  if (!next) return false;
  return !(live.id && next.id && live.id === next.id);
}

/** Current scores where the mode has one number per player, else null. */
function scoresOf(gameType, progress) {
  if (!progress) return null;
  if (gameType === "x01" && progress.s && progress.s.scores) return progress.s.scores;
  const st = progress.state;
  if (!st) return null;
  const pick = (key) => (u) => (st[u] && typeof st[u][key] === "number" ? st[u][key] : null);
  if (gameType === "cricket") return byPlayer(st, pick("points"));
  if (gameType === "baseball") return byPlayer(st, pick("total"));
  if (gameType === "bobs27") return byPlayer(st, pick("score"));
  if (gameType === "scoringDrill") return byPlayer(st, pick("total"));
  return null;
}
function byPlayer(st, get) {
  const out = {};
  for (const u of Object.keys(st)) {
    const v = get(u);
    if (v != null) out[u] = v;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * What Home's "Game in progress" card and the replace prompt say about a
 * live game: { title, players: [{ u, name, score }], label }.
 */
export function liveSummary(game, progress) {
  if (!game) return null;
  const scores = scoresOf(game.gameType, progress);
  const players = (game.players || []).map((u) => ({ u, name: playerLabel(u), score: scores && scores[u] != null ? scores[u] : null }));
  const title = gameTitle(game.gameType, game.config || {});
  const label = players.length > 1 ? `${title} · ${players.map((p) => p.name).join(" vs ")}` : title;
  return { title, players, label };
}
