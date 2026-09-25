/**
 * Which stats the exported player card shows: only ones the player
 * actually has, most telling first, never more than six and never a "—".
 * The grid then shows 2, 4 or 6 tiles (an even count keeps the 2-column
 * layout tidy). Pure.
 */
export function cardStats(stats) {
  if (!stats) return [];
  const x = stats.x01 || {};
  const c = stats.cricket || {};
  const b = stats.baseball || {};
  const out = [];
  const add = (label, value, ok) => ok && out.push({ label, value: String(value) });
  // one headline per mode played
  add("3-Dart Avg", (x.threeDartAvg || 0).toFixed(1), x.games > 0 && x.threeDartAvg > 0);
  add("Cricket MPR", (c.mpr || 0).toFixed(2), c.games > 0 && c.mpr > 0);
  add("Avg Runs", (b.avgRuns || 0).toFixed(1), b.games > 0 && b.avgRuns > 0);
  // then records and depth
  add("High Turn", x.highestTurn, x.highestTurn > 0);
  add("High Out", x.highestCheckout, x.highestCheckout > 0);
  add("Best Leg", `${x.bestLeg} darts`, x.bestLeg > 0);
  add("Best MPR", (c.bestMpr || 0).toFixed(2), c.bestMpr > 0 && c.games > 1);
  add("Best Streak", stats.bestWinStreak, stats.bestWinStreak > 1);
  add("Baseball Games", b.games, b.games > 0);
  add("Cricket Games", c.games, c.games > 0);
  add("X01 Games", x.games, x.games > 0);
  const n = Math.min(6, out.length);
  return out.slice(0, n - (n % 2));
}
