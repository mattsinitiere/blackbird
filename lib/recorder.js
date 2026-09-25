/**
 * The v2 recording contract, shared by every play component.
 *
 * Each game keeps its own rules; this helper only records what happened in
 * one uniform shape so lib/gamestats can analyse any game the same way:
 *
 *   visits[u] = [{ i, r, s0, darts: [{ n, mult, t?, x? }], out }]
 *     i    this player's visit index
 *     r    round / leg / inning / finish index (game-specific meaning)
 *     s0   state before the visit (number or a small object)
 *     t    ms since the game started (omitted when the start is unknown)
 *     x    extra per-dart info (cricket: { m } marks credited)
 *     out  outcome of the visit (game-specific)
 *   events = [{ t, by, on?, turn, ... }]   whole-game log (killer, gotcha)
 *
 * The recorder object lives INSIDE the component's engine state (`s.rec` /
 * `state.rec`), so the JSON-cloned undo history, resume snapshots and the TV
 * cast all carry it for free. Pure: plain objects, no React, no clock unless
 * `now` is passed to stamp().
 */

export const STATS_VERSION = 2;

export function createRecorder({ players, startedAt }) {
  const visits = {};
  for (const u of players || []) visits[u] = [];
  return { v: STATS_VERSION, startedAt: startedAt || null, visits, events: [] };
}

/** Add a recorder to a resumed pre-v2 snapshot; marks it partial. */
export function ensureRecorder(s, { players, startedAt }) {
  if (s && !s.rec) {
    s.rec = createRecorder({ players, startedAt });
    s.rec.partial = true;
  }
  return s;
}

/** Copy a dart with its throw time relative to the game start. */
export function stamp(dart, startedAt, now = Date.now()) {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (Number.isNaN(start)) return { ...dart };
  return { ...dart, t: Math.max(0, Math.round(now - start)) };
}

export function recordVisit(rec, u, { r = 0, s0 = null, darts = [], out = null }) {
  if (!rec) return rec;
  if (!rec.visits[u]) rec.visits[u] = [];
  rec.visits[u].push({ i: rec.visits[u].length, r, s0, darts: darts.map(cleanDart), out });
  return rec;
}

export function recordEvent(rec, ev) {
  if (!rec) return rec;
  if (!rec.events) rec.events = [];
  rec.events.push(ev);
  return rec;
}

/** The per-player v2 block merged into perPlayer[u] at the end of a game. */
export function finishRecorder(rec, u, completedAt) {
  if (!rec) return {};
  const out = { v: STATS_VERSION, startedAt: rec.startedAt || undefined, visits: rec.visits?.[u] || [] };
  const start = rec.startedAt ? Date.parse(rec.startedAt) : NaN;
  const end = completedAt ? Date.parse(completedAt) : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end)) out.durationMs = Math.max(0, end - start);
  if (rec.events && rec.events.length) out.events = rec.events;
  if (rec.partial) out.partial = true;
  return out;
}

/** The legacy flat log entry: just the landing. */
export function stripDarts(darts) {
  return (darts || []).map((d) => ({ n: d.n, mult: d.mult }));
}

function cleanDart(d) {
  const o = { n: d.n, mult: d.mult };
  if (typeof d.t === "number") o.t = d.t;
  if (d.x && typeof d.x === "object") o.x = d.x;
  // the intended target, when the game itself defines it (drills). Never
  // guessed from where the dart landed: absent means "unknown".
  if (d.a && typeof d.a === "object" && Number.isInteger(d.a.n)) o.a = d.a.mult ? { n: d.a.n, mult: d.a.mult } : { n: d.a.n };
  return o;
}
