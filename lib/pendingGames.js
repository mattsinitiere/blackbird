import { applyEloUpdate } from "./stats.js";
import { isBot } from "./bots.js";

/**
 * Finished games that couldn't be saved (no signal, or the request failed)
 * wait here, per account, in localStorage, and are sent later. Sending is
 * safe to repeat: recordGame skips a game_id that already has rows.
 *
 * Elo on a late sync: if the game's rows already exist (an earlier attempt
 * got through but its reply was lost) their stored elo_after is reused, so
 * the update is never applied twice. Otherwise the ranked update is
 * recomputed from the players' current server Elo, so ratings that moved
 * in the meantime aren't overwritten with stale ones.
 */

const key = (userId) => `bb-pending-games:${userId || "anon"}`;
const parkedKey = (userId) => `bb-parked-games:${userId || "anon"}`;

/**
 * A save the server refused for good (a permission or validation error)
 * or that failed this many times is set aside instead of blocking every
 * game queued after it. Parked games stay on the device for the user (or
 * the admin) to look at; nothing is deleted.
 */
export const MAX_ATTEMPTS = 8;
const PERMANENT = new Set(["42501", "22023", "23514", "54000", "22P02"]);
export function isPermanentError(e) {
  return !!e && PERMANENT.has(String(e.code || ""));
}

function storage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readPending(userId, store = storage()) {
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(key(userId)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePending(userId, list, store = storage()) {
  if (!store) return;
  try {
    if (list.length) store.setItem(key(userId), JSON.stringify(list));
    else store.removeItem(key(userId));
  } catch {}
}

export function readParked(userId, store = storage()) {
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(parkedKey(userId)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function park(userId, entry, store) {
  if (!store) return;
  try {
    const list = readParked(userId, store).filter((e) => e.match?.gameId !== entry.match?.gameId);
    list.push({ ...entry, parkedAt: new Date().toISOString() });
    store.setItem(parkedKey(userId), JSON.stringify(list));
  } catch {}
}

/** Add (or replace, by game id) a game waiting to sync. */
export function enqueuePending(userId, entry, store = storage()) {
  const list = readPending(userId, store).filter((e) => e.match?.gameId !== entry.match?.gameId);
  list.push({ ...entry, queuedAt: entry.queuedAt || new Date().toISOString(), attempts: entry.attempts || 0 });
  writePending(userId, list, store);
  return list.length;
}

/** The Elo map to save for a ranked game being synced late. */
export function eloForLateSync({ match, existingRows, currentElo }) {
  const humans = (match.players || []).filter((u) => !isBot(u));
  if (existingRows && existingRows.length) {
    const out = { ...currentElo };
    for (const r of existingRows) if (humans.includes(r.username) && r.elo_after != null) out[r.username] = Number(r.elo_after);
    return out;
  }
  return applyEloUpdate(currentElo, humans, match.winner);
}

// one flush at a time per account
const flushing = new Map();

/**
 * Send every waiting game, oldest first; stop at the first failure (the
 * connection is probably still down), except that a game the server
 * refuses for good, or that has failed MAX_ATTEMPTS times, is parked and
 * the rest carry on. Returns { saved: [gameId], parked: [gameId], left }.
 * `deps` are injected so this stays testable:
 *   existingRows(gameId) -> rows with username, elo_after (or [])
 *   currentElo(usernames) -> { username: elo }
 *   record(args) -> recordGame(args)
 */
export function flushPending(userId, deps, store = storage()) {
  if (flushing.has(userId)) return flushing.get(userId);
  const run = (async () => {
    const saved = [];
    const parked = [];
    let list = readPending(userId, store);
    while (list.length) {
      const entry = list[0];
      const { match, ranked } = entry;
      try {
        const humans = (match.players || []).filter((u) => !isBot(u));
        const currentElo = await deps.currentElo(humans);
        let eloAfter = null;
        if (ranked) {
          const existing = await deps.existingRows(match.gameId);
          eloAfter = eloForLateSync({ match, existingRows: existing, currentElo });
        }
        await deps.record({
          gameId: match.gameId,
          gameType: match.gameType,
          config: match.config,
          players: match.players,
          winner: match.winner,
          perPlayer: match.perPlayer,
          ranked,
          eloAfter,
          currentElo,
          completedAt: match.completedAt,
        });
        saved.push(match.gameId);
        list = readPending(userId, store).filter((e) => e.match?.gameId !== match.gameId);
        writePending(userId, list, store);
      } catch (e) {
        const failed = { ...entry, attempts: (entry.attempts || 0) + 1, lastError: e?.message || String(e), lastCode: e?.code || null };
        if (isPermanentError(e) || failed.attempts >= MAX_ATTEMPTS) {
          park(userId, failed, store);
          parked.push(match.gameId);
          list = readPending(userId, store).filter((x) => x.match?.gameId !== match.gameId);
          writePending(userId, list, store);
          continue;
        }
        list = readPending(userId, store).map((x) => (x.match?.gameId === match.gameId ? failed : x));
        writePending(userId, list, store);
        break;
      }
    }
    return { saved, parked, left: list.length };
  })();
  flushing.set(userId, run);
  return run.finally(() => {
    flushing.delete(userId);
  });
}

/**
 * A save failure in plain words, for the person holding the phone. The
 * important part is the same every time: the game is safe on this device.
 * Codes are Postgres / PostgREST error codes (see isPermanentError).
 */
export function describeSaveError(e) {
  if (!e) return "";
  const code = String(e.code || "");
  const msg = String(e.message || e || "");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "No internet connection. It will sync when you're back online.";
  if (/Failed to fetch|NetworkError|network|timeout|Load failed/i.test(msg) && !code) return "Couldn't reach the server. It will try again automatically.";
  if (code === "42501" || /row-level security|permission/i.test(msg)) return "The server refused the save (a permission problem on the server, not something you did). Tell the site admin.";
  if (code === "PGRST202" || code === "42883") return "The server's save function is missing. Tell the site admin.";
  if (code === "22023" || code === "23514" || code === "22P02") return sentence(`The server rejected this game's data: ${msg}`);
  return msg ? sentence(`Couldn't save: ${msg}`) : "Couldn't save.";
}

// a reason always ends a sentence, so "… They're safe on this device." reads right
const sentence = (t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/**
 * Everything Home needs to show about this account's unsynced games:
 * how many wait, how many were set aside, and why the last try failed.
 */
export function syncStatus(userId, store = storage()) {
  const pending = readPending(userId, store);
  const parked = readParked(userId, store);
  const failing = pending.find((e) => e.lastError) || null;
  return {
    pending: pending.length,
    parked: parked.length,
    attempts: failing ? failing.attempts || 0 : 0,
    lastError: failing ? describeSaveError({ code: failing.lastCode, message: failing.lastError }) : "",
    parkedError: parked.length ? describeSaveError({ code: parked[parked.length - 1].lastCode, message: parked[parked.length - 1].lastError }) : "",
  };
}

/**
 * Put every set-aside game back at the front of the queue with a fresh
 * attempt count (after the server is fixed, or to try again). Returns the
 * new queue length.
 */
export function retryParked(userId, store = storage()) {
  const parked = readParked(userId, store);
  if (!parked.length) return readPending(userId, store).length;
  const ids = new Set(parked.map((e) => e.match?.gameId));
  const rest = readPending(userId, store).filter((e) => !ids.has(e.match?.gameId));
  const back = parked
    .map(({ parkedAt, ...e }) => ({ ...e, attempts: 0 }))
    .sort((a, b) => String(a.match?.completedAt || "").localeCompare(String(b.match?.completedAt || "")));
  writePending(userId, [...back, ...rest], store);
  try {
    store.removeItem(parkedKey(userId));
  } catch {}
  return back.length + rest.length;
}

/** Every unsynced game on this device (waiting and set aside), as one JSON backup. */
export function queueBackup(userId, store = storage()) {
  return JSON.stringify({ exportedAt: new Date().toISOString(), account: userId, pending: readPending(userId, store), parked: readParked(userId, store) }, null, 1);
}
