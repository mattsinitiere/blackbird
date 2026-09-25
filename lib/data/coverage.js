/**
 * What a data read actually covered, so answers can say "based on 42 games
 * from Mar 3 to Sep 20" instead of implying a whole career. Unknown values
 * stay null rather than being guessed.
 */

/** True when a row carries a usable dart log (v2 visits or the legacy flat log). */
export function hasDartLog(row) {
  const s = row?.stats;
  if (!s || typeof s !== "object") return false;
  return (Array.isArray(s.visits) && s.visits.length > 0) || (Array.isArray(s.darts) && s.darts.length > 0);
}

/**
 * @param {object} o
 * @param {string|null} o.requested   what was asked for ("last 30 days", "game X")
 * @param {object} o.filters          filters applied in the query
 * @param {object} o.page             paginate() result ({ asOf, status, reason, pages })
 * @param {object[]} o.rows           camelCase rows returned
 * @param {boolean} o.hasStats        whether stats (and so dart logs) were selected
 * @param {string|null} o.sample      set when rows are a deliberate sample ("newest 15")
 */
export function buildCoverage({ requested = null, filters = {}, page, rows, hasStats, sample = null }) {
  const games = new Set();
  let oldest = null;
  let newest = null;
  let withLogs = 0;
  for (const r of rows) {
    games.add(r.gameId);
    const t = r.completedAt;
    if (t && (!oldest || t < oldest)) oldest = t;
    if (t && (!newest || t > newest)) newest = t;
    if (hasStats && hasDartLog(r)) withLogs++;
  }
  const status = page.status === "complete" ? "complete" : page.status === "limited" ? "sample" : "partial";
  return {
    requested,
    asOf: page.asOf,
    filters,
    rowsRetrieved: rows.length,
    distinctGames: games.size,
    oldest,
    newest,
    withLogs: hasStats ? withLogs : null,
    withoutLogs: hasStats ? rows.length - withLogs : null,
    status,
    sample,
    reason: page.reason || null,
  };
}

/** One line for the model or the UI. */
export function coverageNote(c) {
  if (!c) return "";
  const span = c.oldest && c.newest ? ` from ${c.oldest.slice(0, 10)} to ${c.newest.slice(0, 10)}` : "";
  const base = `${c.distinctGames} game${c.distinctGames === 1 ? "" : "s"}${span}`;
  if (c.status === "partial") return `${base} (incomplete: ${c.reason})`;
  if (c.status === "sample") return `${base} (a sample: ${c.sample})`;
  return base;
}
