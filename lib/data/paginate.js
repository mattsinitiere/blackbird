/**
 * Keyset pagination over game_results, ordered by (completed_at, id).
 *
 * Why keyset and not offset: rows keep arriving (offline games sync late),
 * and an offset shifts under inserts. The cursor is the (completed_at, id)
 * of the last row actually returned, so the next page starts strictly after
 * it. `id` is unique, which breaks ties between games saved in the same
 * instant.
 *
 * Completion is established only by an EMPTY page. A short page proves
 * nothing: the server may cap responses below the page size we asked for
 * (PostgREST's max-rows), so we keep going until the server has nothing
 * after the cursor.
 *
 * Consistency: every page is filtered to completed_at <= asOf, captured
 * once at the start, so rows finished after the walk began are left out.
 * This is NOT a database snapshot. A row inserted during the walk with an
 * older completed_at (a late offline sync) is included only if it sorts
 * after the cursor at the moment its page is read; one that sorts behind
 * the cursor is missed until the next request. Corrections to rows already
 * read are not seen by this walk.
 *
 * Bounds: maxRows, maxPages and maxMs stop runaway walks. Hitting one makes
 * the result `partial` with a reason, never silently complete.
 */

export const PAGE_DEFAULTS = { pageSize: 1000, maxRows: 20000, maxPages: 60, maxMs: 9000 };

/**
 * @param {(page: {after: {ts: string, id: string} | null, limit: number, asOf: string, desc: boolean}) =>
 *          Promise<{ data: object[] | null, error?: object | null }>} fetchPage
 * @param {object} [opts]
 * @param {string} [opts.asOf]      ISO upper bound on completed_at (default: now)
 * @param {boolean} [opts.desc]     newest first (cursor moves backwards)
 * @param {number} [opts.limit]     stop after this many rows (a deliberate sample, reported as such)
 * @returns {Promise<{ rows: object[], pages: number, asOf: string, status: "complete"|"partial"|"limited", reason: string|null }>}
 */
export async function paginate(fetchPage, opts = {}) {
  const { pageSize, maxRows, maxPages, maxMs } = { ...PAGE_DEFAULTS, ...opts };
  const asOf = opts.asOf || new Date().toISOString();
  const desc = !!opts.desc;
  const want = opts.limit != null ? Math.max(0, opts.limit) : null;
  const started = Date.now();
  const rows = [];
  const seen = new Set();
  let after = null;
  let pages = 0;
  let status = "complete";
  let reason = null;

  for (;;) {
    if (want != null && rows.length >= want) {
      status = "limited";
      reason = `stopped at the requested ${want} rows`;
      break;
    }
    if (pages >= maxPages) {
      status = "partial";
      reason = `page limit (${maxPages}) reached`;
      break;
    }
    if (rows.length >= maxRows) {
      status = "partial";
      reason = `row limit (${maxRows}) reached`;
      break;
    }
    if (Date.now() - started > maxMs) {
      status = "partial";
      reason = `time limit (${maxMs} ms) reached`;
      break;
    }
    const limit = want != null ? Math.min(pageSize, want - rows.length) : pageSize;
    const { data, error } = await fetchPage({ after, limit, asOf, desc });
    if (error) throw Object.assign(new Error(error.message || "Query failed"), { cause: error });
    pages++;
    const page = data || [];
    if (page.length === 0) break; // the only proof of completion

    let advanced = false;
    for (const r of page) {
      if (after && !isAfter(r, after, desc)) continue; // defensive: never step backwards
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(r);
      advanced = true;
    }
    const last = page[page.length - 1];
    const next = { ts: last.completed_at, id: last.id };
    if (!advanced || (after && next.ts === after.ts && next.id === after.id)) {
      // the server handed back the same rows again: stop rather than loop
      status = "partial";
      reason = "the cursor stopped advancing";
      break;
    }
    after = next;
  }
  if (want != null && rows.length > want) rows.length = want;
  return { rows, pages, asOf, status, reason };
}

/** True when row sorts strictly after the cursor in the walk's direction. */
export function isAfter(row, cursor, desc = false) {
  const a = micros(row.completed_at);
  const b = micros(cursor.ts);
  if (a !== b) return desc ? a < b : a > b;
  return desc ? String(row.id) < String(cursor.id) : String(row.id) > String(cursor.id);
}

/**
 * A timestamp as microseconds since the epoch. Postgres keeps microseconds
 * and Date.parse keeps milliseconds; comparing at ms would treat two rows a
 * few µs apart as a tie and could skip one.
 */
export function micros(ts) {
  const ms = Date.parse(ts);
  const frac = /\.(\d+)/.exec(String(ts));
  const extra = frac ? parseInt((frac[1] + "000000").slice(3, 6), 10) : 0;
  return ms * 1000 + extra;
}

/** PostgREST values with ':' '+' ',' etc. must be double-quoted inside or(). */
function q(v) {
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

/**
 * A fetchPage for supabase-js: `base()` returns a fresh filtered query
 * (select + eq/in/gte filters) and this adds the cursor, as-of bound,
 * ordering and page size.
 */
export function supabasePager(base) {
  return async ({ after, limit, asOf, desc }) => {
    let query = base().lte("completed_at", asOf);
    if (after) {
      const op = desc ? "lt" : "gt";
      query = query.or(`completed_at.${op}.${q(after.ts)},and(completed_at.eq.${q(after.ts)},id.${op}.${q(after.id)})`);
    }
    return query
      .order("completed_at", { ascending: !desc })
      .order("id", { ascending: !desc })
      .limit(limit);
  };
}
