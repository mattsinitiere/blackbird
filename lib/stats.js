import { X01_TARGETS } from "./constants";

/**
 * Elo ratings, recomputed deterministically from full match history.
 * Start 1500, K=24. Winner updated pairwise against each opponent.
 */
export function computeElo(matches, usernames) {
  const R = {};
  usernames.forEach((u) => (R[u] = 1500));
  const ordered = [...matches].sort(
    (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
  );
  const K = 24;
  for (const m of ordered) {
    const w = m.winner;
    if (!(w in R)) R[w] = 1500;
    for (const l of m.players) {
      if (l === w) continue;
      if (!(l in R)) R[l] = 1500;
      const expectedW = 1 / (1 + Math.pow(10, (R[l] - R[w]) / 400));
      R[w] += K * (1 - expectedW);
      R[l] += K * (0 - (1 - expectedW));
    }
  }
  return R;
}

export function computeStats(matches) {
  const s = {};
  const init = () => ({
    games: 0,
    wins: 0,
    x01: {
      games: 0,
      wins: 0,
      darts: 0,
      points: 0,
      highestTurn: 0,
      bestLeg: null,
      highestCheckout: 0,
    },
    cricket: { games: 0, wins: 0, marks: 0, rounds: 0, points: 0 },
    baseball: { games: 0, wins: 0, runs: 0 },
  });

  for (const m of matches) {
    for (const u of m.players) {
      if (!s[u]) s[u] = init();
      s[u].games++;
      const won = m.winner === u;
      if (won) s[u].wins++;
      const pp = (m.perPlayer && m.perPlayer[u]) || {};

      if (m.gameType === "x01") {
        const x = s[u].x01;
        x.games++;
        if (won) x.wins++;
        x.darts += pp.dartsThrown || 0;
        x.points += pp.pointsScored || 0;
        x.highestTurn = Math.max(x.highestTurn, pp.highestTurn || 0);
        if (won) {
          if (x.bestLeg == null || (pp.dartsThrown || 999) < x.bestLeg) {
            x.bestLeg = pp.dartsThrown;
          }
          x.highestCheckout = Math.max(x.highestCheckout, pp.checkout || 0);
        }
      } else if (m.gameType === "cricket") {
        const c = s[u].cricket;
        c.games++;
        if (won) c.wins++;
        c.marks += pp.marks || 0;
        c.rounds += pp.rounds || 0;
        c.points += pp.pointsScored || 0;
      } else if (m.gameType === "baseball") {
        const b = s[u].baseball;
        b.games++;
        if (won) b.wins++;
        b.runs += pp.runs || 0;
      }
    }
  }

  for (const u in s) {
    const p = s[u];
    p.winPct = p.games ? (p.wins / p.games) * 100 : 0;
    p.x01.threeDartAvg = p.x01.darts ? (p.x01.points / p.x01.darts) * 3 : 0;
    p.x01.winPct = p.x01.games ? (p.x01.wins / p.x01.games) * 100 : 0;
    p.cricket.mpr = p.cricket.rounds ? p.cricket.marks / p.cricket.rounds : 0;
    p.cricket.winPct = p.cricket.games
      ? (p.cricket.wins / p.cricket.games) * 100
      : 0;
    p.baseball.avgRuns = p.baseball.games ? p.baseball.runs / p.baseball.games : 0;
    p.baseball.winPct = p.baseball.games
      ? (p.baseball.wins / p.baseball.games) * 100
      : 0;
  }
  return s;
}

export function headToHead(matches, a, b) {
  let aw = 0;
  let bw = 0;
  let n = 0;
  for (const m of matches) {
    if (m.players.includes(a) && m.players.includes(b)) {
      n++;
      if (m.winner === a) aw++;
      else if (m.winner === b) bw++;
    }
  }
  return { aw, bw, n };
}

export function allTargetsClosed(marks) {
  return X01_TARGETS.every((t) => (marks[t] || 0) >= 3);
}
