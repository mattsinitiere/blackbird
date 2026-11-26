import { analyzeGame, withBotRows } from "./gamestats/index.js";
import { x01Config } from "./gamestats/x01.js";
import { isFinishable } from "./x01log.js";
import { dartValue } from "./darts.js";
import { isBot, botFor, playerLabel, BOTS } from "./bots.js";

/**
 * The deeper statistics on the profile: a career heatmap, dart-by-dart
 * splits, pace, when games happen, pressure numbers, rivalry timelines,
 * practice against ranked, and progress up the bot ladder. Everything is
 * derived from rows the app already saves; nothing new is captured.
 *
 * Every function takes "games": one player's rows as matches, run through
 * the stats engine by `prepareGames`. Ranked rows carry result win / loss.
 * Practice rows come through lib/practiceStats practiceAsMatches, so they
 * carry win / loss against a bot, or "solo" (counted as a game, never in a
 * win rate). Pure: no React, no network, the clock is injectable.
 *
 * Honesty rules, because the logs have limits:
 *  - A dart's time is when the scorer tapped it, and a visit is usually
 *    tapped in a burst after the darts are pulled. So pace is measured per
 *    turn and per game, never per dart.
 *  - Timings exist only on stats v2 rows; older games are left out of pace.
 *  - Small samples return null rather than a number that means nothing.
 */

const ms = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};
const r1 = (n, d = 1) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const pctOf = (part, whole) => (whole > 0 ? r1((part / whole) * 100) : null);

/*
 * When is a difference worth saying out loud? A card only names a best and
 * a worst (dart, day, time, innings) when the gap is big enough to matter
 * AND unlikely to be luck: a two-sided test at about 95% (|z| >= 2) over
 * enough games. Otherwise it says the numbers are about the same.
 */
export const Z_MIN = 2;

/** z for the gap between two rates, hits1 / n1 against hits2 / n2. */
export function rateZ(h1, n1, h2, n2) {
  if (!(n1 > 0 && n2 > 0)) return 0;
  const p = (h1 + h2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se > 0 ? (h1 / n1 - h2 / n2) / se : 0;
}

/** z for the gap between two means, each { n, sum, sq } (sq: sum of squares). */
export function meanZ(a, b) {
  if (!(a.n > 1 && b.n > 1)) return 0;
  const m1 = a.sum / a.n;
  const m2 = b.sum / b.n;
  const v1 = Math.max(0, (a.sq - a.n * m1 * m1) / (a.n - 1));
  const v2 = Math.max(0, (b.sq - b.n * m2 * m2) / (b.n - 1));
  const se = Math.sqrt(v1 / a.n + v2 / b.n);
  if (se > 0) return (m1 - m2) / se;
  return m1 === m2 ? 0 : Infinity * Math.sign(m1 - m2);
}

// best and worst of a list by `value`, or null unless the gap clears `minGap` and the test
function bestWorst(list, value, z, minGap) {
  const ok = list.filter((x) => value(x) != null);
  if (ok.length < 2) return null;
  let best = ok[0];
  let worst = ok[0];
  for (const x of ok) {
    if (value(x) > value(best)) best = x;
    if (value(x) < value(worst)) worst = x;
  }
  if (value(best) - value(worst) < minGap) return null;
  if (Math.abs(z(best, worst)) < Z_MIN) return null;
  return { best, worst };
}

/** One player's match rows, oldest first, each with its analysis. */
export function prepareGames(matchRows, me) {
  return (matchRows || [])
    .filter((row) => row && row.username === me && row.result !== "practice")
    .sort((a, b) => ms(a.completedAt) - ms(b.completedAt))
    .map((row) => {
      let a = null;
      try {
        a = analyzeGame(row);
      } catch {
        a = null;
      }
      return { row, a, won: row.result === "win", decided: row.result !== "solo" };
    });
}

// games where a logged dart is either on the target or a miss
const TARGET_GAMES = new Set(["baseball", "cricket"]);

const ofType = (games, gameType) => (gameType ? games.filter((g) => g.row.gameType === gameType) : games);

/** Game types present, most played first: the filter chips. */
export function gameTypesPlayed(games) {
  const n = new Map();
  for (const g of games) n.set(g.row.gameType, (n.get(g.row.gameType) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([gameType, games]) => ({ gameType, games }));
}

/* ------------------------------------------------------------------ */
/* 1. Where the darts landed                                           */
/* ------------------------------------------------------------------ */

/**
 * Every logged dart by bed, shaped for the DartHeatmap chart:
 * cells { "20": { S, D, T }, "25": { S, D } }. A miss has no position in
 * the log (in Baseball and Cricket any dart off the target is a miss), so
 * misses are counted beside the board, not on it. `missKind` says what a
 * miss means here: "target" once any Baseball or Cricket dart is among them
 * (off the target number, usually still on the board), else "board".
 */
export function landingHeatmap(games, gameType = null) {
  const cells = {};
  let darts = 0;
  let misses = 0;
  let offTarget = 0;
  let counted = 0;
  for (const g of ofType(games, gameType)) {
    const list = g.a?.darts || [];
    if (!list.length) continue;
    counted++;
    const targetGame = TARGET_GAMES.has(g.row.gameType);
    for (const d of list) {
      darts++;
      if (!d.n || !d.mult) {
        misses++;
        if (targetGame) offTarget++;
        continue;
      }
      const cell = (cells[String(d.n)] = cells[String(d.n)] || { S: 0, D: 0, T: 0 });
      cell[d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"]++;
    }
  }
  let top = null;
  for (const [n, c] of Object.entries(cells)) {
    for (const ring of ["S", "D", "T"]) {
      if (c[ring] && (!top || c[ring] > top.darts)) top = { label: n === "25" ? (ring === "D" ? "Bull" : "25") : `${ring}${n}`, darts: c[ring] };
    }
  }
  // a Baseball or Cricket "miss" is any dart off the target number, which
  // usually still hit the board: then the honest word is "off target"
  return { cells, darts, misses, missKind: offTarget > 0 ? "target" : "board", games: counted, top };
}

/* ------------------------------------------------------------------ */
/* 2. First, second and third dart                                     */
/* ------------------------------------------------------------------ */

/**
 * How each dart of the visit does. `target`: share of first / second /
 * third darts that were on target, over Baseball and Cricket games with
 * misses logged. `scoring`: average points of each dart in X01. Either is
 * null without darts to go on. Each carries a `verdict` { best, worst }
 * (dart indexes) only when the gap is real: DART_MIN_GAMES games, a gap of
 * DART_MIN_GAP and the z test; otherwise null, "about the same".
 */
export const DART_MIN_GAMES = 5;
export const DART_MIN_GAP = { target: 3, scoring: 1 }; // points of on-target %, points a dart

export function dartByDart(games, gameType = null) {
  const target = [0, 1, 2].map(() => ({ darts: 0, hits: 0 }));
  const scoring = [0, 1, 2].map(() => ({ darts: 0, points: 0, sq: 0 }));
  let targetGames = 0;
  let scoringGames = 0;
  for (const g of ofType(games, gameType)) {
    const a = g.a;
    if (!a || !a.quality?.hasVisits) continue;
    if (TARGET_GAMES.has(g.row.gameType) && a.quality.hasMisses) {
      targetGames++;
      for (const d of a.darts) {
        if (d.pos > 2) continue;
        target[d.pos].darts++;
        if (d.n && d.mult) target[d.pos].hits++;
      }
    } else if (g.row.gameType === "x01") {
      scoringGames++;
      for (const d of a.darts) {
        if (d.pos > 2) continue;
        scoring[d.pos].darts++;
        scoring[d.pos].points += d.value || 0;
        scoring[d.pos].sq += (d.value || 0) ** 2;
      }
    }
  }
  const verdict = (games, pick) => {
    if (games < DART_MIN_GAMES) return null;
    const bw = pick();
    return bw ? { best: bw.best.i, worst: bw.worst.i } : null;
  };
  const tPos = target.map((p, i) => ({ i, ...p, pct: pctOf(p.hits, p.darts) }));
  const sPos = scoring.map((p, i) => ({ i, ...p, avg: p.darts ? r1(p.points / p.darts) : null }));
  return {
    target: target[0].darts
      ? {
          games: targetGames,
          positions: tPos.map((p) => ({ darts: p.darts, pct: p.pct })),
          verdict: verdict(targetGames, () => bestWorst(tPos, (p) => p.pct, (a, b) => rateZ(a.hits, a.darts, b.hits, b.darts), DART_MIN_GAP.target)),
        }
      : null,
    scoring: scoring[0].darts
      ? {
          games: scoringGames,
          positions: sPos.map((p) => ({ darts: p.darts, avg: p.avg })),
          verdict: verdict(scoringGames, () => bestWorst(sPos, (p) => p.avg, (a, b) => meanZ({ n: a.darts, sum: a.points, sq: a.sq }, { n: b.darts, sum: b.points, sq: b.sq }), DART_MIN_GAP.scoring)),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Pace of play                                                     */
/* ------------------------------------------------------------------ */

const MIN_GAME_MS = 20 * 1000;
const MAX_GAME_MS = 3 * 60 * 60 * 1000; // longer than this was left open, not played
export const PACE_SPLIT_MIN = 6;

// the one number that says how well a game of each mode went
const HEADLINE = {
  x01: { label: "3-dart avg", decimals: 1, of: (list) => { const d = list.reduce((s, g) => s + (g.a.totals.dartsThrown || 0), 0); return d ? (list.reduce((s, g) => s + (g.a.totals.points || 0), 0) / d) * 3 : null; } },
  cricket: { label: "MPR", decimals: 2, of: (list) => { const l = list.filter((g) => g.a.metrics?.mpr != null); return l.length ? l.reduce((s, g) => s + g.a.metrics.mpr, 0) / l.length : null; } },
  baseball: { label: "runs", decimals: 1, of: (list) => (list.length ? list.reduce((s, g) => s + (g.a.totals.runs || 0), 0) / list.length : null) },
};

function paceHalf(list, head) {
  const decided = list.filter((g) => g.decided);
  return {
    games: list.length,
    winPct: decided.length ? pctOf(decided.filter((g) => g.won).length, decided.length) : null,
    metric: head ? r1(head.of(list), head.decimals) : null,
    secPerTurn: r1(list.reduce((s, g) => s + g.pace, 0) / list.length, 0),
  };
}

/**
 * How long games take and whether quick games go better than slow ones.
 * Pace is seconds per turn: the game's length divided by this player's
 * visits (so it includes waiting for the others). Per mode, timed games
 * are split at the median pace into a quick half and a slow half once
 * there are PACE_SPLIT_MIN of them.
 */
export function paceOfPlay(games, gameType = null) {
  const pool = ofType(games, gameType);
  const timed = [];
  for (const g of pool) {
    const dur = g.a?.totals?.durationMs;
    const visits = g.a?.visits?.length || 0;
    if (!(dur >= MIN_GAME_MS && dur <= MAX_GAME_MS) || !visits) continue;
    timed.push({ ...g, dur, pace: dur / 1000 / visits });
  }
  const byMode = new Map();
  for (const g of timed) byMode.set(g.row.gameType, [...(byMode.get(g.row.gameType) || []), g]);
  const modes = [...byMode.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([gt, list]) => {
      const head = HEADLINE[gt] || null;
      const out = {
        gameType: gt,
        games: list.length,
        avgMinutes: r1(list.reduce((s, g) => s + g.dur, 0) / list.length / 60000),
        secPerTurn: r1(list.reduce((s, g) => s + g.pace, 0) / list.length, 0),
        metricLabel: head?.label || null,
        metricDecimals: head?.decimals ?? 1,
        quick: null,
        slow: null,
      };
      if (list.length >= PACE_SPLIT_MIN) {
        const sorted = [...list].sort((a, b) => a.pace - b.pace);
        const half = Math.floor(sorted.length / 2);
        out.quick = paceHalf(sorted.slice(0, half), head);
        out.slow = paceHalf(sorted.slice(sorted.length - half), head);
      }
      return out;
    });
  return {
    total: pool.length,
    timed: timed.length,
    avgMinutes: timed.length ? r1(timed.reduce((s, g) => s + g.dur, 0) / timed.length / 60000) : null,
    totalHours: timed.length ? r1(timed.reduce((s, g) => s + g.dur, 0) / 3600000) : null,
    modes,
  };
}

/* ------------------------------------------------------------------ */
/* 4. When games happen                                                */
/* ------------------------------------------------------------------ */

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const BLOCKS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"]; // three-hour blocks, by their start
export const WHEN_MIN = 5; // decided games before a day or time is ranked
export const WHEN_MIN_GAP = 10; // points of win %

/** The viewer's local day (0 = Monday) and hour of an ISO time. */
export function localClock(iso) {
  const d = new Date(iso);
  return { day: (d.getDay() + 6) % 7, hour: d.getHours() };
}

/**
 * Games and wins by day of the week and three-hour block of the day a game
 * finished. A day or block needs WHEN_MIN decided games to be ranked, and
 * `bestDay` / `worstDay` / `bestBlock` are named only when the best and the
 * worst are WHEN_MIN_GAP points apart and pass the z test; otherwise null.
 */
export function whenPlayed(games, gameType = null, clock = localClock) {
  const cell = () => ({ games: 0, decided: 0, wins: 0 });
  const grid = DAYS.map(() => BLOCKS.map(cell));
  const byDay = DAYS.map(cell);
  const byBlock = BLOCKS.map(cell);
  let total = 0;
  for (const g of ofType(games, gameType)) {
    if (!ms(g.row.completedAt)) continue;
    const { day, hour } = clock(g.row.completedAt);
    const block = Math.min(7, Math.max(0, Math.floor(hour / 3)));
    total++;
    for (const c of [grid[day][block], byDay[day], byBlock[block]]) {
      c.games++;
      if (g.decided) c.decided++;
      if (g.decided && g.won) c.wins++;
    }
  }
  const finish = (c) => ({ ...c, winPct: c.decided ? pctOf(c.wins, c.decided) : null });
  const rank = (list, labels) =>
    bestWorst(
      list.map((c, i) => ({ label: labels[i], ...finish(c) })).filter((c) => c.decided >= WHEN_MIN),
      (c) => c.winPct,
      (a, b) => rateZ(a.wins, a.decided, b.wins, b.decided),
      WHEN_MIN_GAP
    );
  const days = rank(byDay, DAYS);
  const blocks = rank(byBlock, BLOCKS);
  const busiest = (list, labels) => list.map((c, i) => ({ label: labels[i], games: c.games })).sort((a, b) => b.games - a.games)[0];
  return {
    total,
    max: Math.max(0, ...grid.flat().map((c) => c.games)),
    grid: grid.map((row) => row.map(finish)),
    byDay: byDay.map(finish),
    byBlock: byBlock.map(finish),
    bestDay: days?.best || null,
    worstDay: days?.worst || null,
    bestBlock: blocks?.best || null,
    busiestDay: total ? busiest(byDay, DAYS) : null,
    busiestBlock: total ? busiest(byBlock, BLOCKS) : null,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Under pressure                                                   */
/* ------------------------------------------------------------------ */

/**
 * Opponents' analyses for one player's X01 games, keyed by game id, from
 * every row the viewer can see: the opponents' own rows, or the bot's
 * stats carried on the player's row. Only X01 needs them.
 */
export function x01Opponents(allRows, me) {
  const byGame = new Map();
  for (const r of allRows || []) {
    if (!r || r.gameType !== "x01" || !r.gameId) continue;
    byGame.set(r.gameId, [...(byGame.get(r.gameId) || []), r]);
  }
  const out = new Map();
  for (const [id, rows] of byGame) {
    if (!rows.some((r) => r.username === me)) continue;
    const others = withBotRows(rows).filter((r) => r.username !== me);
    const list = [];
    for (const r of others) {
      try {
        const a = analyzeGame(r);
        if (a.visits.length) list.push(a);
      } catch {
        /* an unreadable opponent row just means no pressure data for that game */
      }
    }
    if (list.length) out.set(id, list);
  }
  return out;
}

// what an opponent had left when `mine` began: by tap time when both logs
// have it, otherwise by the number of visits each had thrown in the leg
function opponentLeft(opp, mine, myIndexInLeg, start) {
  const leg = opp.visits.filter((v) => (v.r || 0) === (mine.r || 0));
  const myT = mine.darts?.[0]?.t;
  let before;
  if (typeof myT === "number" && leg.some((v) => typeof v.darts?.[0]?.t === "number")) before = leg.filter((v) => typeof v.darts?.[0]?.t === "number" && v.darts[0].t < myT);
  else before = leg.slice(0, myIndexInLeg);
  const last = before[before.length - 1];
  return last ? last.out?.rem ?? last.s0 : start;
}

/**
 * Two pressure splits.
 *  - `baseball`: average runs per inning in innings 1-3, 4-6 and 7-9, over
 *    games that went the full nine. `trend` is "late" or "early" when the
 *    last three innings beat (or trail) the first three by PRESSURE_MIN_GAP
 *    runs and the z test, over PRESSURE_MIN_GAMES games; otherwise null.
 *  - `x01`: checkout % (hits per dart thrown at a finish, the same
 *    definition as the X01 card) when an opponent was also on a finish
 *    (170 or less left) against when they were not. Needs the opponent's
 *    visits, so only games whose other rows are visible count.
 */
export const PRESSURE_MIN_GAMES = 5;
export const PRESSURE_MIN_GAP = 0.2; // runs an inning

export function underPressure(games, opponents = new Map()) {
  const thirds = [0, 1, 2].map(() => ({ runs: 0, innings: 0, sq: 0 }));
  let fullGames = 0;
  for (const g of games) {
    if (g.row.gameType !== "baseball" || !g.a) continue;
    const innings = g.a.rounds.map((r) => r.runs);
    if (innings.length < 9) continue;
    fullGames++;
    for (let i = 0; i < 9; i++) {
      thirds[Math.floor(i / 3)].runs += innings[i] || 0;
      thirds[Math.floor(i / 3)].sq += (innings[i] || 0) ** 2;
      thirds[Math.floor(i / 3)].innings++;
    }
  }
  // "late" when the last three innings are really better, "early" when worse, else null
  let trend = null;
  if (fullGames >= PRESSURE_MIN_GAMES) {
    const [e, , l] = thirds.map((t) => ({ n: t.innings, sum: t.runs, sq: t.sq }));
    const gap = l.sum / l.n - e.sum / e.n;
    if (Math.abs(gap) >= PRESSURE_MIN_GAP && Math.abs(meanZ(l, e)) >= Z_MIN) trend = gap > 0 ? "late" : "early";
  }
  const baseball = fullGames
    ? { games: fullGames, early: r1(thirds[0].runs / thirds[0].innings, 2), middle: r1(thirds[1].runs / thirds[1].innings, 2), late: r1(thirds[2].runs / thirds[2].innings, 2), trend }
    : null;

  const split = { pressure: { chances: 0, hits: 0 }, calm: { chances: 0, hits: 0 } };
  let x01Games = 0;
  for (const g of games) {
    if (g.row.gameType !== "x01" || !g.a?.quality?.hasVisits) continue;
    const opps = opponents.get(g.row.gameId);
    if (!opps) continue;
    const { start, doubleOut } = x01Config(g.row.config);
    x01Games++;
    const seenInLeg = new Map();
    for (const v of g.a.visits) {
      const leg = v.r || 0;
      const idx = seenInLeg.get(leg) || 0;
      seenInLeg.set(leg, idx + 1);
      let rem = v.s0;
      let chances = 0;
      for (const d of v.darts || []) {
        if (isFinishable(rem, doubleOut)) chances++;
        rem -= dartValue(d);
      }
      if (!chances) continue;
      const oppLeft = Math.min(...opps.map((o) => opponentLeft(o, v, idx, start)));
      const side = oppLeft <= 170 ? split.pressure : split.calm;
      side.chances += chances;
      if (v.out?.k === "win") side.hits++;
    }
  }
  const side = (s) => ({ ...s, pct: pctOf(s.hits, s.chances) });
  const x01 = split.pressure.chances + split.calm.chances > 0 ? { games: x01Games, pressure: side(split.pressure), calm: side(split.calm) } : null;
  return { baseball, x01 };
}

/* ------------------------------------------------------------------ */
/* 6. Rivalry timelines                                                */
/* ------------------------------------------------------------------ */

/**
 * The running head-to-head against each human opponent: after every
 * meeting, wins minus losses so far. A game a third player won moves
 * nothing. Most-played opponents first.
 */
export function rivalryTimelines(games, limit = 8) {
  const by = new Map();
  for (const g of games) {
    for (const opp of g.row.opponents || []) {
      if (isBot(opp)) continue;
      const t = by.get(opp) || { opponent: opp, games: 0, wins: 0, losses: 0, other: 0, margin: 0, points: [] };
      t.games++;
      if (g.row.winner === g.row.username) {
        t.wins++;
        t.margin++;
      } else if (g.row.winner === opp) {
        t.losses++;
        t.margin--;
      } else t.other++;
      t.points.push({ x: t.games, y: t.margin, date: g.row.completedAt });
      by.set(opp, t);
    }
  }
  return [...by.values()].sort((a, b) => b.games - a.games).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 7. Practice against ranked                                          */
/* ------------------------------------------------------------------ */

const DAY_MS = 86400000;
const OVERLAY = {
  x01: { label: "X01 3-dart average", short: "3-dart avg", decimals: 1, ok: (s) => s.dartsThrown > 0, of: (rows) => { const d = rows.reduce((a, r) => a + r.stats.dartsThrown, 0); return (rows.reduce((a, r) => a + (r.stats.pointsScored || 0), 0) / d) * 3; } },
  cricket: { label: "Cricket MPR", short: "MPR", decimals: 2, ok: (s) => s.rounds > 0, of: (rows) => rows.reduce((a, r) => a + (r.stats.marks || 0), 0) / rows.reduce((a, r) => a + r.stats.rounds, 0) },
  baseball: { label: "Baseball runs per game", short: "runs", decimals: 1, ok: (s) => s.runs != null, of: (rows) => rows.reduce((a, r) => a + (r.stats.runs || 0), 0) / rows.length },
};

function bucketStart(iso, unit) {
  const d = new Date(iso);
  if (unit === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return day.getTime() - ((day.getDay() + 6) % 7) * DAY_MS; // Monday
}

/**
 * Ranked and practice form on one time axis, for each of X01, Cricket and
 * Baseball the player has both in. Weekly buckets, or monthly once the
 * history is longer than about half a year. Each entry is shaped for
 * MultiLineChart: `labels` and two point lists whose x is the bucket's
 * position, plus the overall figure for each side.
 */
export function practiceVsRanked(rankedGames, practiceGames) {
  const out = [];
  for (const [gt, m] of Object.entries(OVERLAY)) {
    const pick = (games) => games.filter((g) => g.row.gameType === gt && g.row.stats && m.ok(g.row.stats)).map((g) => g.row);
    const ranked = pick(rankedGames);
    const practice = pick(practiceGames);
    if (!ranked.length || !practice.length) continue;
    const times = [...ranked, ...practice].map((r) => ms(r.completedAt));
    const unit = Math.max(...times) - Math.min(...times) > 26 * 7 * DAY_MS ? "month" : "week";
    const keys = [...new Set([...ranked, ...practice].map((r) => bucketStart(r.completedAt, unit)))].sort((a, b) => a - b);
    const x = new Map(keys.map((k, i) => [k, i + 1]));
    const lineOf = (rows) => {
      const groups = new Map();
      for (const r of rows) {
        const k = bucketStart(r.completedAt, unit);
        groups.set(k, [...(groups.get(k) || []), r]);
      }
      return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, list]) => ({ x: x.get(k), y: r1(m.of(list), m.decimals), n: list.length, date: new Date(k).toISOString() }));
    };
    out.push({
      gameType: gt,
      label: m.label,
      short: m.short,
      decimals: m.decimals,
      unit,
      labels: keys.map((k) => new Date(k).toLocaleDateString(undefined, unit === "month" ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" })),
      ranked: { games: ranked.length, overall: r1(m.of(ranked), m.decimals), points: lineOf(ranked) },
      practice: { games: practice.length, overall: r1(m.of(practice), m.decimals), points: lineOf(practice) },
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 8. Bot ladder progress                                              */
/* ------------------------------------------------------------------ */

export const BOT_PROGRESS_MIN = 2;

/**
 * Win % against each bot as the games against it add up: one line per bot,
 * x = the nth game against that bot, y = win % so far. Bots in ladder
 * order; a bot needs BOT_PROGRESS_MIN games to get a line.
 */
export function botProgress(practiceGames) {
  return botRecords(practiceGames).filter((t) => t.games >= BOT_PROGRESS_MIN);
}

// every bot played, in ladder order, with its record and win % over time
function botRecords(practiceGames) {
  const by = new Map();
  for (const g of practiceGames) {
    const bot = (g.row.opponents || []).find(isBot);
    if (!bot || !g.decided) continue;
    const t = by.get(bot) || { bot, name: playerLabel(bot), level: botFor(bot)?.level ?? 99, color: botFor(bot)?.color || null, games: 0, wins: 0, points: [] };
    t.games++;
    if (g.won) t.wins++;
    t.points.push({ x: t.games, y: Math.round((t.wins / t.games) * 100), date: g.row.completedAt });
    by.set(bot, t);
  }
  const order = new Map(BOTS.map((b, i) => [b.id, i]));
  return [...by.values()]
    .map((t) => ({ ...t, losses: t.games - t.wins, winPct: Math.round((t.wins / t.games) * 100) }))
    .sort((a, b) => (order.get(a.bot) ?? 99) - (order.get(b.bot) ?? 99));
}

/**
 * Where the player stands on the bot ladder: every bot played, in ladder
 * order, plus the one to work on. `climbing` is the lowest bot played with
 * a win rate under 50%; when every bot played is at 50% or better, `next`
 * is the first bot above the highest one played (null at the top).
 */
export function botClimb(practiceGames) {
  const bots = botRecords(practiceGames).filter((t) => BOTS.some((b) => b.id === t.bot));
  const climbing = bots.find((t) => t.winPct < 50) || null;
  let next = null;
  if (!climbing && bots.length) {
    const top = Math.max(...bots.map((t) => BOTS.findIndex((b) => b.id === t.bot)));
    const b = BOTS[top + 1];
    if (b) next = { bot: b.id, name: b.name };
  }
  return { bots, climbing, next };
}
