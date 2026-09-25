/**
 * A tiny in-memory stand-in for the supabase-js query builder over
 * game_results, supporting exactly what lib/data/* uses: select, eq, in,
 * neq, gte, lt, lte, filter(cs), or(cursor), order, limit. `cap` mimics
 * PostgREST's max-rows: pages are silently cut to it, like the real
 * server. `visible(row)` mimics row-level security.
 */
import { micros } from "../../lib/data/paginate.js";

export function fakeSupabase(rows, { cap = 1000, visible = () => true, onQuery = null } = {}) {
  return {
    queries: 0,
    from(table) {
      const self = this;
      const st = { filters: [], order: [], limit: null, cols: "*" };
      const b = {
        select(cols) { st.cols = cols; return b; },
        eq(k, v) { st.filters.push((r) => r[k] === v); return b; },
        neq(k, v) { st.filters.push((r) => r[k] !== v); return b; },
        in(k, vs) { st.filters.push((r) => vs.includes(r[k])); return b; },
        gte(k, v) { st.filters.push((r) => micros(r[k]) >= micros(v)); return b; },
        lt(k, v) { st.filters.push((r) => micros(r[k]) < micros(v)); return b; },
        lte(k, v) { st.filters.push((r) => micros(r[k]) <= micros(v)); return b; },
        filter(k, op, v) {
          if (op !== "cs") throw new Error("fake: only cs");
          const want = JSON.parse(v);
          st.filters.push((r) => want.every((x) => (r[k] || []).includes(x)));
          return b;
        },
        or(expr) {
          // completed_at.gt."TS",and(completed_at.eq."TS",id.gt."ID")
          const m = /^completed_at\.(gt|lt)\."([^"]+)",and\(completed_at\.eq\."([^"]+)",id\.(gt|lt)\."([^"]+)"\)$/.exec(expr);
          if (!m) throw new Error(`fake: unsupported or(${expr})`);
          const [, op, ts, , , id] = m;
          const t = micros(ts);
          st.filters.push((r) => {
            const rt = micros(r.completed_at);
            return op === "gt" ? rt > t || (rt === t && r.id > id) : rt < t || (rt === t && r.id < id);
          });
          return b;
        },
        order(k, { ascending }) { st.order.push([k, ascending]); return b; },
        limit(n) { st.limit = n; return b; },
        then(resolve, reject) {
          self.queries++;
          onQuery?.(st);
          if (table !== "game_results") return Promise.resolve({ data: [], error: null }).then(resolve, reject);
          let out = rows.filter(visible).filter((r) => st.filters.every((f) => f(r)));
          out.sort((a, c) => {
            for (const [k, asc] of st.order) {
              const x = k === "completed_at" ? micros(a[k]) : a[k];
              const y = k === "completed_at" ? micros(c[k]) : c[k];
              if (x < y) return asc ? -1 : 1;
              if (x > y) return asc ? 1 : -1;
            }
            return 0;
          });
          out = out.slice(0, Math.min(st.limit ?? Infinity, cap));
          const cols = st.cols === "*" ? null : st.cols.split(",").map((c) => c.trim());
          if (cols) out = out.map((r) => Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])));
          return Promise.resolve({ data: out.map((r) => ({ ...r })), error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  };
}

/** n rows for one player, many sharing a timestamp. */
export function manyRows(n, { username = "Ann", start = Date.UTC(2024, 0, 1), tieEvery = 7, gameType = "x01" } = {}) {
  const out = [];
  let t = start;
  // a per-player prefix keeps ids unique across players, like real uuids
  const tag = [...username].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0").slice(0, 8);
  for (let i = 0; i < n; i++) {
    if (i % tieEvery !== 0) t += 60000; // groups of rows share a timestamp
    const id = `${tag}-0000-4000-8000-${String(i).padStart(12, "0")}`;
    out.push({
      id,
      game_id: `${tag}-1000-4000-8000-${String(i).padStart(12, "0")}`,
      username,
      game_type: gameType,
      config: { startScore: 501, doubleOut: true },
      winner: i % 3 === 0 ? username : "Bob",
      result: i % 5 === 4 ? "practice" : i % 3 === 0 ? "win" : "loss",
      opponents: i % 5 === 4 ? [] : ["Bob"],
      stats: { dartsThrown: 30, pointsScored: 501 },
      elo_after: 1000,
      completed_at: new Date(t).toISOString(),
    });
  }
  return out;
}
