import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, round, isMiss } from "./common.js";

export const TTT_GRID = [20, 19, 18, 17, 16, 15, 14, 13, 12];

/** Tic-Tac-Toe analyzer. v2 rows carry board strings per visit and the winning line. */
export function analyzeTicTacToe(pp, config, { username, winner } = {}) {
  const stored = storedVisits(pp);
  const legacy = !stored;
  const visits = stored || [];
  const darts = flattenVisits(visits);
  const claimed = visits.length ? visits.reduce((a, v) => a + (v.out?.c?.length || 0), 0) : null;
  const cancelled = visits.length ? visits.reduce((a, v) => a + (v.out?.x?.length || 0), 0) : null;
  const onGrid = darts.filter((d) => !isMiss(d) && TTT_GRID.includes(d.n)).length;
  const metrics = {
    squaresClaimed: pp?.squaresClaimed ?? null,
    claimed,
    cancelled,
    line: Array.isArray(pp?.line) ? pp.line : null,
    lineNumbers: Array.isArray(pp?.line) ? pp.line.map((i) => TTT_GRID[i]) : null,
    dartsPerClaim: claimed ? round((darts.length || pp?.dartsThrown || 0) / claimed, 2) : null,
    gridHitRate: darts.length ? pct(onGrid, darts.length) : null,
    missPct: darts.length ? pct(darts.filter(isMiss).length, darts.length) : null,
    boards: visits.map((v) => v.out?.b).filter(Boolean),
  };
  const rounds = visits.map((v) => ({ r: v.r, label: `Turn ${v.i + 1}`, claimed: v.out?.c || [], cancelled: v.out?.x || [], board: v.out?.b || null }));
  return baseAnalysis({
    gameType: "tictactoe",
    pp,
    username,
    winner,
    quality: quality({ legacy, hasVisits: visits.length > 0, hasMisses: true, exactLanding: false, hasTimes: hasTimes(visits), partial: !!pp?.partial, notes: legacy ? ["board history was not recorded before stats v2"] : [] }),
    visits,
    rounds,
    totals: { dartsThrown: darts.length || pp?.dartsThrown || 0, turns: visits.length, durationMs: pp?.durationMs ?? null },
    perDart: perDartBasics(darts, { exactLanding: false }),
    metrics,
    seriesOut: {},
  });
}
