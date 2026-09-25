import { BASE_ELO } from "./constants.js";
import { weekKey, monthKey } from "./data/tz.js";
import { computePractice } from "./practice.js";
import { checkoutRange } from "./x01log.js";
import { analyzeGame } from "./gamestats/index.js";
import { computeCareer } from "./gamestats/career.js";
import { computeAchievements, nextUp } from "./achievements.js";
import { rivalry } from "./stats.js";

/**
 * Everything Blackbird AI may cite about one player, built in the browser
 * from the rows the app already holds and sent with each question.
 *
 * Three layers, all derived from the same competitive rows:
 * - `me` / `checkouts` / `cricket`: career totals, including the finishing
 *   stats replayed from each X01 dart log (see lib/x01log.js).
 * - `form` and `series`: trends. Series are named lists of { x, y, date,
 *   label?, n? } the model can quote or chart by key (lib/aiChart.js).
 * - `recentGames`: one compact row per recent game with derived numbers,
 *   never the raw dart log.
 * Pure: no React, no network. `now` is injectable for tests.
 */

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;
const MAX_GAME_POINTS = 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function round(n, d = 0) {
  const f = Math.pow(10, d);
  return Math.round((n || 0) * f) / f;
}

const pct = (hits, chances) => (chances ? round((hits / chances) * 100, 1) : null);
const avg = (sum, n, d = 1) => (n ? round(sum / n, d) : null);
const day = (iso) => (iso || "").slice(0, 10);

function x01Config(config) {
  const c = config || {};
  return { start: c.startScore || c.start || 501, doubleOut: !!c.doubleOut };
}

/** Per-game derived numbers for one competitive row, from the stats engine. */
export function describeGame(r, me) {
  const pp = r.stats || {};
  const a = analyzeGame(r);
  const mt = a.metrics || {};
  const base = {
    date: day(r.completedAt),
    game: r.gameType,
    result: r.result,
    opponents: r.opponents || [],
    eloAfter: r.eloAfter == null ? null : Math.round(r.eloAfter),
    logged: a.quality.hasVisits,
  };
  if (r.gameType === "x01") {
    const { start, doubleOut } = x01Config(r.config);
    const valid = a.quality.hasVisits;
    return {
      ...base,
      start,
      doubleOut,
      legs: r.config?.legs > 1 ? r.config.legs : undefined,
      dartsThrown: a.totals.dartsThrown,
      threeDartAvg: mt.threeDartAvg ?? null,
      first9Avg: mt.first9Avg ?? null,
      highestTurn: mt.highestTurn || 0,
      checkout: r.winner === me ? mt.checkout || 0 : 0,
      checkoutChances: valid ? mt.checkoutChances : null,
      checkoutHit: valid ? mt.checkoutHits : r.winner === me ? 1 : 0,
      busts: valid ? mt.busts : null,
      tons: valid ? mt.tons : null,
      one80s: valid ? mt.one80s : null,
      legsWon: mt.legsWon,
      bestLeg: mt.bestLeg,
      _rp: { valid, chances: mt.checkoutChances || 0, checkoutHit: mt.checkoutHits || 0, checkoutScore: mt.checkout || 0, chancesByRange: mt.chancesByRange || {}, busts: mt.busts || 0, tons: mt.tons || 0, ton40s: mt.ton40s || 0, one80s: mt.one80s || 0 },
    };
  }
  if (r.gameType === "cricket") {
    return {
      ...base,
      marks: mt.marks || 0,
      rounds: mt.rounds || 0,
      mpr: mt.mpr ?? null,
      points: mt.points || 0,
      bestRound: mt.bestRound ?? null,
      missPct: mt.missPct ?? null,
      deadDarts: mt.deadDarts ?? null,
      closingOrder: mt.closingOrder ?? null,
    };
  }
  if (r.gameType === "baseball") return { ...base, runs: mt.runs || 0, biggestInning: mt.biggestInning ?? null, hitRate: mt.hitRate ?? null, runsPerInning: a.rounds.map((x) => x.runs) };
  const extra = { dartsThrown: a.totals.dartsThrown };
  for (const k of ["shanghai", "halves", "resetsDealt", "resetsReceived", "finalScore", "totalScore", "targetsHit", "livesRemaining", "isKiller", "squaresClaimed"]) if (pp[k] != null) extra[k] = pp[k];
  for (const k of ["bestRound", "dartsToFinish", "hitRate", "busts", "kills", "dartsToBecomeKiller", "halvedRounds", "claimed", "cancelled"]) if (mt[k] != null) extra[k] = mt[k];
  return { ...base, ...extra };
}

// months and Monday-start weeks in the reporting timezone, so the chat,
// the server and the daily allowance agree whatever device runs this
function bucketKey(date, unit) {
  return unit === "month" ? monthKey(date) : weekKey(date);
}

function bucketLabel(key, unit) {
  const [y, m, d] = key.split("-").map(Number);
  if (unit === "month") return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  return `${MONTHS[m - 1]} ${d}`;
}

function newBucket(key, unit) {
  return {
    key,
    label: bucketLabel(key, unit),
    games: 0,
    wins: 0,
    x01Games: 0,
    x01Darts: 0,
    x01Points: 0,
    first9Sum: 0,
    first9N: 0,
    chances: 0,
    hits: 0,
    busts: 0,
    tons: 0,
    one80s: 0,
    highestCheckout: 0,
    cricketGames: 0,
    marks: 0,
    rounds: 0,
  };
}

function addToBucket(b, g) {
  b.games++;
  if (g.result === "win") b.wins++;
  if (g.game === "x01") {
    b.x01Games++;
    b.x01Darts += g.dartsThrown || 0;
    b.x01Points += g.threeDartAvg != null ? ((g.threeDartAvg / 3) * (g.dartsThrown || 0)) : 0;
    if (g.first9Avg != null) {
      b.first9Sum += g.first9Avg;
      b.first9N++;
    }
    if (g.checkoutChances != null) {
      b.chances += g.checkoutChances;
      b.hits += g.checkoutHit;
    }
    b.busts += g.busts || 0;
    b.tons += g.tons || 0;
    b.one80s += g.one80s || 0;
    b.highestCheckout = Math.max(b.highestCheckout, g.checkout || 0);
  } else if (g.game === "cricket") {
    b.cricketGames++;
    b.marks += g.marks || 0;
    b.rounds += g.rounds || 0;
  }
}

function finishBucket(b) {
  return {
    period: b.label,
    games: b.games,
    wins: b.wins,
    winPct: pct(b.wins, b.games),
    x01Games: b.x01Games,
    threeDartAvg: b.x01Darts ? round((b.x01Points / b.x01Darts) * 3, 1) : null,
    first9Avg: avg(b.first9Sum, b.first9N),
    checkoutPct: pct(b.hits, b.chances),
    checkoutChances: b.chances,
    checkoutsHit: b.hits,
    highestCheckout: b.highestCheckout || null,
    busts: b.busts,
    tons: b.tons,
    one80s: b.one80s,
    cricketGames: b.cricketGames,
    mpr: b.rounds ? round(b.marks / b.rounds, 2) : null,
  };
}

/** Buckets in chronological order, one per period, only periods with games. */
export function bucketize(games, unit, limit) {
  const map = new Map();
  for (const g of games) {
    const key = bucketKey(g.date, unit);
    if (!map.has(key)) map.set(key, newBucket(key, unit));
    addToBucket(map.get(key), g);
  }
  return [...map.keys()]
    .sort()
    .slice(-limit)
    .map((k) => ({ key: k, ...finishBucket(map.get(k)) }));
}

export function summarise(games) {
  const b = newBucket("all", "month");
  for (const g of games) addToBucket(b, g);
  const f = finishBucket(b);
  delete f.period;
  return f;
}

/** Turn a bucket list into a chart series for one metric. */
export function seriesFrom(buckets, metric, nKey = "games") {
  const out = [];
  buckets.forEach((b) => {
    if (b[metric] == null) return;
    out.push({ x: out.length + 1, y: b[metric], date: b.key, label: b.period, n: b[nKey] });
  });
  return out;
}

export function runningWinPct(games) {
  let wins = 0;
  return games
    .map((g, i) => {
      if (g.result === "win") wins++;
      return { x: i + 1, y: round((wins / (i + 1)) * 100), date: g.date };
    })
    .slice(-MAX_GAME_POINTS);
}

export function gameSeries(games, pick) {
  const out = [];
  for (const g of games) {
    const y = pick(g);
    if (y == null) continue;
    out.push({ x: out.length + 1, y, date: g.date });
  }
  return out.slice(-MAX_GAME_POINTS);
}

export function buildMySummary({ me, stats, elo, results, practice, players, social = null, now = new Date() }) {
  const s = stats?.[me];
  const ranked = (players || [])
    .filter((p) => !p.hidden && stats?.[p.username])
    .map((p) => p.username)
    .sort((a, b) => (elo[b] || BASE_ELO) - (elo[a] || BASE_ELO));
  const rows = (results || [])
    .filter((r) => r.username === me && r.result !== "practice")
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const games = rows.map((r) => describeGame(r, me));

  // --- head to head, from my own rows (each carries the winner) ---
  const handleOf = new Map((players || []).map((p) => [p.username, p.handle || null]));
  const opponents = [...new Set(rows.flatMap((r) => r.opponents || []))];
  const headToHead = opponents
    .map((o) => {
      const rv = rivalry(rows, me, o);
      return {
        opponent: o,
        handle: handleOf.get(o) || null,
        games: rv.games,
        wins: rv.wins,
        losses: rv.losses,
        otherWinner: rv.otherWinner,
        winPct: rv.winPct,
        opponentElo: Math.round(elo[o] || BASE_ELO),
        byGameType: rv.byGameType,
        streak: rv.streak,
        last5: rv.last5.map((m) => ({ date: day(m.date), game: m.gameType, result: m.result, winner: m.winner, players: m.players })),
        firstPlayed: day(rv.firstPlayed),
        lastPlayed: day(rv.lastPlayed),
      };
    })
    .sort((a, b) => b.games - a.games);

  // --- checkouts (X01), replayed from the dart logs ---
  const x01 = games.filter((g) => g.game === "x01");
  const withLog = x01.filter((g) => g._rp?.valid);
  const chances = withLog.reduce((a, g) => a + g._rp.chances, 0);
  const hits = withLog.reduce((a, g) => a + g._rp.checkoutHit, 0);
  const byRange = {};
  for (const k of ["2-40", "41-70", "71-100", "101-170"]) byRange[k] = { chances: 0, hits: 0, pct: null };
  for (const g of withLog) {
    for (const k in g._rp.chancesByRange) byRange[k].chances += g._rp.chancesByRange[k];
    if (g._rp.checkoutHit) byRange[checkoutRange(g._rp.checkoutScore)].hits++;
  }
  for (const k in byRange) byRange[k].pct = pct(byRange[k].hits, byRange[k].chances);
  const finishes = x01.filter((g) => g.checkout > 0);
  const checkouts = {
    definition: "checkout chances = darts thrown while the remaining score could be finished with that dart; checkout % = checkouts hit ÷ chances. byRange groups by the score the visit started on.",
    pct: pct(hits, chances),
    chances,
    hits,
    gamesWithDartLog: withLog.length,
    highest: finishes.length ? Math.max(...finishes.map((g) => g.checkout)) : 0,
    average: avg(finishes.reduce((a, g) => a + g.checkout, 0), finishes.length),
    byRange,
    tonPlusFinishes: finishes.filter((g) => g.checkout >= 100).length,
    recentFinishes: finishes.slice(-10).map((g) => ({ score: g.checkout, date: g.date, opponents: g.opponents })),
    busts: withLog.reduce((a, g) => a + g._rp.busts, 0),
    bustsPerGame: avg(withLog.reduce((a, g) => a + g._rp.busts, 0), withLog.length, 2),
  };

  // --- scoring (X01) ---
  const scoring = {
    tons: withLog.reduce((a, g) => a + g._rp.tons, 0),
    ton40s: withLog.reduce((a, g) => a + g._rp.ton40s, 0),
    one80s: withLog.reduce((a, g) => a + g._rp.one80s, 0),
    tonsPerGame: avg(withLog.reduce((a, g) => a + g._rp.tons, 0), withLog.length, 2),
    dartAvgByPosition: s?.x01?.dartAvg && s.x01.dartAvg.some((v) => v > 0) ? s.x01.dartAvg.map((v) => round(v, 1)) : null,
    bestGameAvg: x01.length ? Math.max(...x01.map((g) => g.threeDartAvg || 0)) : null,
    worstGameAvg: x01.length ? Math.min(...x01.map((g) => (g.threeDartAvg == null ? Infinity : g.threeDartAvg))) : null,
  };
  if (scoring.worstGameAvg === Infinity) scoring.worstGameAvg = null;

  // --- cricket ---
  const perNumber = {};
  if (s?.cricket?.perNumber) {
    for (const [k, v] of Object.entries(s.cricket.perNumber)) perNumber[k] = { darts: v.darts, marks: v.hits, marksPerDart: avg(v.hits, v.darts, 2) };
  }

  // --- trends ---
  const monthly = bucketize(games, "month", 12);
  const weekly = bucketize(games, "week", 12);
  const last10 = summarise(games.slice(-10));
  const prev10 = summarise(games.slice(-20, -10));
  const t = now.getTime();
  const last30 = summarise(games.filter((g) => t - new Date(g.date).getTime() <= 30 * DAY_MS));
  const prev30 = summarise(games.filter((g) => { const a = t - new Date(g.date).getTime(); return a > 30 * DAY_MS && a <= 60 * DAY_MS; }));

  const series = {
    eloByGame: gameSeries(games, (g) => g.eloAfter),
    winPctByGame: runningWinPct(games),
    x01AvgByGame: gameSeries(x01, (g) => g.threeDartAvg),
    first9ByGame: gameSeries(x01, (g) => g.first9Avg),
    checkoutPctByGame: gameSeries(x01, (g) => (g.checkoutChances ? round((g.checkoutHit / g.checkoutChances) * 100) : null)),
    checkoutChancesByGame: gameSeries(x01, (g) => g.checkoutChances),
    highestTurnByGame: gameSeries(x01, (g) => g.highestTurn || null),
    mprByGame: gameSeries(games.filter((g) => g.game === "cricket"), (g) => g.mpr),
    x01AvgByMonth: seriesFrom(monthly, "threeDartAvg", "x01Games"),
    first9ByMonth: seriesFrom(monthly, "first9Avg", "x01Games"),
    checkoutPctByMonth: seriesFrom(monthly, "checkoutPct", "checkoutChances"),
    winPctByMonth: seriesFrom(monthly, "winPct"),
    gamesByMonth: seriesFrom(monthly, "games"),
    tonsByMonth: seriesFrom(monthly, "tons", "x01Games"),
    mprByMonth: seriesFrom(monthly, "mpr", "cricketGames"),
    x01AvgByWeek: seriesFrom(weekly, "threeDartAvg", "x01Games"),
    checkoutPctByWeek: seriesFrom(weekly, "checkoutPct", "checkoutChances"),
    winPctByWeek: seriesFrom(weekly, "winPct"),
    gamesByWeek: seriesFrom(weekly, "games"),
  };

  // --- practice ---
  const pr = computePractice(practice || [], me, now);
  const drills = {};
  for (const [k, d] of Object.entries(pr.drills)) {
    drills[k] = { label: d.label, sessions: d.count, personalBest: d.pb ? { value: d.pb.value, date: day(d.pb.date) } : null, last: d.last ? { value: d.series[d.series.length - 1]?.y, date: day(d.last.completedAt) } : null };
    series[`${k}ByDrillSession`] = d.series.map((p) => ({ ...p, date: day(p.date) }));
  }
  series.soloX01AvgBySession = pr.x01.series.map((p) => ({ ...p, date: day(p.date) }));
  const emptySeries = Object.keys(series).filter((k) => !series[k].length);
  for (const k of emptySeries) delete series[k];

  const recent = games.slice(-40).map(({ _rp, ...g }) => g);

  // career numbers for every game mode (series stripped: the model reads
  // trends from `series` and `trends` above)
  const careerFull = computeCareer({ results: rows, practice }, me);
  const careers = Object.fromEntries(Object.entries(careerFull).map(([k, v]) => { const { series: _s, ...rest } = v; return [k, rest]; }));

  const badges = computeAchievements({ me, results, practice, social, now });
  const achievements = {
    unlocked: badges.filter((b) => b.unlocked).sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt)).slice(0, 12).map((b) => ({ id: b.id, title: b.title, earnedAt: b.earnedAt })),
    unlockedCount: badges.filter((b) => b.unlocked).length,
    total: badges.length,
    nextUp: nextUp(badges, 5).map((b) => ({ id: b.id, title: b.title, description: b.description, progress: b.progress })),
    // every badge as "id|Title|1" (1 = unlocked), so the model can name
    // and draw any of them by id; compact to keep the prompt small
    all: badges.map((b) => `${b.id}|${b.title}|${b.unlocked ? 1 : 0}`),
    allFormat: "each entry is id|title|unlocked (1 or 0)",
    progressKinds: "progress.kind: 'count' = value of target done so far (say how many to go); 'best' = the best single-game value so far, not a running total (never say 'N to go'); 'streak' = the CURRENT run of consecutive wins (best = best-ever run).",
  };

  return {
    me: s
      ? {
          name: me,
          elo: Math.round(elo[me] || BASE_ELO),
          rankInCircle: ranked.indexOf(me) + 1,
          circleSize: ranked.length,
          circle: social ? { following: social.following?.length || 0, followers: social.followers?.length || 0 } : null,
          games: s.games,
          wins: s.wins,
          winPct: round(s.winPct, 1),
          currentWinStreak: s.winStreak,
          bestWinStreak: s.bestWinStreak,
          lastFive: s.lastFive,
          firstGame: games[0]?.date || null,
          lastGame: games[games.length - 1]?.date || null,
          x01: { games: s.x01.games, wins: s.x01.wins, winPct: round(s.x01.winPct, 1), threeDartAvg: round(s.x01.threeDartAvg, 1), first9Avg: round(s.x01.first9Avg, 1), highestTurn: s.x01.highestTurn, highestCheckout: s.x01.highestCheckout, bestLeg: s.x01.bestLeg, checkoutPct: checkouts.pct },
          cricket: { games: s.cricket.games, wins: s.cricket.wins, winPct: round(s.cricket.winPct, 1), mpr: round(s.cricket.mpr, 2), bestMpr: round(s.cricket.bestMpr, 2), marksPerDartByNumber: perNumber },
          baseball: { games: s.baseball.games, wins: s.baseball.wins, runs: s.baseball.runs, avgRuns: round(s.baseball.avgRuns, 1) },
          aroundTheClock: { games: s.aroundTheClock.games, wins: s.aroundTheClock.wins, avgDartsToWin: round(s.aroundTheClock.avgDarts, 1) },
          killer: s.killer,
          shanghai: s.shanghai,
          halveIt: s.halveit,
          gotcha: s.gotcha,
          ticTacToe: s.tictactoe,
        }
      : { name: me, games: 0 },
    checkouts,
    scoring,
    form: { last10Games: last10, previous10Games: prev10, last30Days: last30, previous30Days: prev30 },
    trends: { byMonth: monthly.map(({ key, ...m }) => m), byWeek: weekly.map(({ key, ...w }) => ({ ...w, weekOf: key })) },
    series,
    headToHead,
    definitions: {
      headToHead: "one entry per opponent, from your own ranked games. wins = games you won, losses = games that opponent won, otherWinner = multiplayer games a third player won (in games, in neither wins nor losses). byGameType splits the same record per game mode. last5 results: W you won, L they won, O someone else won. streak counts consecutive W or L, skipping O.",
    },
    roster: (players || []).map((p) => ({ name: p.username, handle: p.handle || null })),
    careers,
    achievements,
    recentGames: recent,
    practice: {
      sessions: pr.count,
      thisWeek: pr.thisWeek,
      drills,
      soloX01: { sessions: pr.x01.count, bestAvg: pr.x01.bestAvg },
      bots: { games: pr.bots.games, wins: pr.bots.wins, ladderLevel: pr.bots.level, ladder: pr.bots.ladder.map((l) => ({ bot: l.bot.name || l.bot.id, wins: l.wins, losses: l.losses, unlocked: l.unlocked })) },
    },
    today: day(now.toISOString()),
  };
}
