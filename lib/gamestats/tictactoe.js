import { baseAnalysis, quality, flattenVisits, perDartBasics, hasTimes, storedVisits, pct, round, isMiss } from "./common.js";

export const TTT_GRID = [20, 19, 18, 17, 16, 15, 14, 13, 12];

export const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diags
];

/** The first completed line on a board: { winner, line }, or null. */
export function ticTacToeWinner(board) {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return { winner: board[a], line };
  }
  return null;
}

/**
 * The play screen's rules, shared with its live preview: each dart at a
 * grid number claims a free square, cancels the opponent's claim on it,
 * or does nothing on one already yours; anything else is a miss. Returns
 * a new board with the claimed and cancelled square indexes, plus the
 * winning line as soon as a dart completes one (later darts can't undo
 * it: they never take away the thrower's own squares). Pure.
 */
export function applyTicTacToeVisit(board, cur, darts) {
  const b = board.slice();
  const claimed = [];
  const cancelled = [];
  let won = null;
  for (const dart of darts || []) {
    const idx = TTT_GRID.indexOf(dart.n);
    if (idx === -1 || dart.mult === 0) continue;
    if (b[idx] === cur) continue;
    if (b[idx] != null) {
      b[idx] = null;
      cancelled.push(idx);
    } else {
      b[idx] = cur;
      claimed.push(idx);
    }
    won = won || ticTacToeWinner(b);
  }
  return { board: b, claimed, cancelled, won };
}

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
