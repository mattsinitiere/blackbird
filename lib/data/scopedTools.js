/**
 * Blackbird AI's tools over targeted queries. Each call fetches only the
 * rows it needs, with the filters pushed into the database (player, mode,
 * dates, opponent, one game), then reuses the in-memory tool code in
 * lib/aiTools.js on that slice. Results carry a `coverage` block so the
 * model can say what the numbers are based on.
 *
 * `fetch` is injected (lib/data/queries.js fetchResults bound to the user's
 * client in production; an in-memory fake in tests).
 */

import { createToolRunner, newRegistry, toolWindow } from "../aiTools.js";

/** Resolve a player name / @handle / first name against the roster. */
export function makeResolver(players, me) {
  const byKey = new Map();
  for (const p of players || []) {
    byKey.set(String(p.username).toLowerCase(), p.username);
    if (p.handle) byKey.set(String(p.handle).toLowerCase(), p.username);
  }
  return (name, fallback = me) => {
    if (!name) return fallback;
    const k = String(name).trim().replace(/^@/, "").toLowerCase();
    if (byKey.has(k)) return byKey.get(k);
    const hit = [...byKey.values()].find((u) => String(u).toLowerCase().startsWith(k));
    return hit || String(name).trim();
  };
}

/**
 * @param {object} o
 * @param {(filters: object, opts?: object) => Promise<{rows: object[], coverage: object}>} o.fetch
 * @param {object[]} o.players  roster [{ username, handle }]
 * @param {string} o.me         the signed-in player's username (from their session)
 */
export function createScopedToolRunner({ fetch, players = [], me, now = new Date() }) {
  const reg = newRegistry();
  const resolve = makeResolver(players, me);
  const cache = new Map();
  const load = async (filters, opts = {}) => {
    const key = JSON.stringify([filters, opts]);
    if (!cache.has(key)) cache.set(key, fetch(filters, opts));
    return cache.get(key);
  };

  /** Filters a tool's arguments allow us to push into the query. */
  const pushdown = (a = {}, { practice = false } = {}) => {
    const w = toolWindow(a.from, a.to);
    const f = { username: resolve(a.player) };
    if (a.gameType) f.gameType = a.gameType;
    if (w.from != null) f.from = new Date(w.from);
    if (w.to != null) f.to = new Date(w.to);
    if (a.result === "win" || a.result === "loss") f.result = a.result;
    else if (!(practice || a.includePractice)) f.includePractice = false;
    const opp = a.opponent ? resolve(a.opponent, null) : null;
    if (opp) f.opponent = opp;
    return f;
  };

  async function rowsFor(name, a) {
    if (name === "analyze_game") {
      let gameId = a.gameId;
      if (!gameId) {
        const f = pushdown({ player: a.player, gameType: a.gameType }, { practice: true });
        const latest = await load(f, { newest: 1, requested: "latest game" });
        gameId = latest.rows[0]?.gameId;
        if (!gameId) return { rows: [], coverage: latest.coverage };
      }
      return load({ gameId }, { requested: `game ${gameId}` });
    }
    if (name === "dart_heatmap") return load(pushdown(a, { practice: true }), { requested: "dart log" });
    return load(pushdown(a), { requested: name });
  }

  return {
    series: reg.series,
    heatmaps: reg.heatmaps,
    register: (points, n) => {
      const id = `s${++reg.sn}`;
      reg.series[id] = { name: n, points };
      return id;
    },
    async run(name, args) {
      const a = args && typeof args === "object" ? args : {};
      let got;
      try {
        got = await rowsFor(name, a);
      } catch (e) {
        return { error: `Couldn't load games: ${e?.message || "query failed"}` };
      }
      const runner = createToolRunner({ rows: got.rows, players, me, now, shared: reg });
      const out = runner.run(name, a);
      return out && typeof out === "object" && !Array.isArray(out) ? { ...out, coverage: got.coverage } : { result: out, coverage: got.coverage };
    },
  };
}
