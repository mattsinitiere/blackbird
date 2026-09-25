import { isBot } from "./bots.js";

/**
 * Data for the Matchup screen: the default rival, the Elo prediction and
 * the tale-of-the-tape rows. Pure; the head-to-head record itself comes
 * from rivalry() in lib/stats.js.
 */

/** Elo expected score for A against B (0..1). */
export function winChance(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * The opponent `me` has played most among `candidates` (ranked games,
 * humans only); otherwise the first other candidate.
 */
export function defaultRival(results, me, candidates) {
  const pool = (candidates || []).filter((u) => u !== me && !isBot(u));
  if (!pool.length) return null;
  const counts = {};
  for (const r of results || []) {
    if (r.username !== me || r.result === "practice") continue;
    for (const o of r.opponents || []) if (pool.includes(o)) counts[o] = (counts[o] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : pool[0];
}

const fixed = (d) => (v) => v.toFixed(d);
const whole = (v) => String(Math.round(v));

/**
 * Tale-of-the-tape rows for two players' stats (from computeStats) and Elo.
 * A row appears only when at least one side has that stat; `better` is
 * "a", "b" or null (a tie, or only one side has it).
 */
export function tapeRows(sa, sb, eloA, eloB) {
  const rows = [];
  const add = (key, label, a, b, fmt, { need = (v) => v != null && v > 0 } = {}) => {
    const hasA = need(a);
    const hasB = need(b);
    if (!hasA && !hasB) return;
    let better = null;
    if (hasA && hasB && a !== b) better = a > b ? "a" : "b";
    rows.push({ key, label, a: hasA ? fmt(a) : "–", b: hasB ? fmt(b) : "–", av: hasA ? a : 0, bv: hasB ? b : 0, better });
  };
  add("elo", "Elo", Math.round(eloA), Math.round(eloB), whole, { need: (v) => v != null });
  const games = (s) => s?.games || 0;
  if (games(sa) || games(sb)) {
    add("winPct", "Win %", games(sa) ? sa.winPct : null, games(sb) ? sb.winPct : null, (v) => `${Math.round(v)}%`, { need: (v) => v != null });
    add("games", "Games", games(sa), games(sb), whole);
  }
  add("avg", "3-Dart Avg", sa?.x01?.darts ? sa.x01.threeDartAvg : null, sb?.x01?.darts ? sb.x01.threeDartAvg : null, fixed(1));
  add("mpr", "Cricket MPR", sa?.cricket?.rounds ? sa.cricket.mpr : null, sb?.cricket?.rounds ? sb.cricket.mpr : null, fixed(2));
  add("runs", "Baseball Runs", sa?.baseball?.games ? sa.baseball.avgRuns : null, sb?.baseball?.games ? sb.baseball.avgRuns : null, fixed(1));
  add("streak", "Best Streak", sa?.bestWinStreak || 0, sb?.bestWinStreak || 0, whole);
  return rows;
}
