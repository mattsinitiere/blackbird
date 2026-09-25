import { describeGame, bucketize, summarise, seriesFrom, runningWinPct, gameSeries, round } from "./aiSummary.js";
import { computeStats, rivalry } from "./stats.js";
import { computeCareer } from "./gamestats/career.js";
import { analyzeGame, analyzeMatch } from "./gamestats/index.js";
import { playerLabel } from "./bots.js";

/**
 * Tools Blackbird AI can call while answering (app/api/insights/route.js).
 * They run on the server over the game rows the signed-in user can read
 * (fetched with their own token, so row-level security applies), and reuse
 * the app's own stats code. Pure: rows in, JSON out; no network.
 *
 * Series and heatmaps a tool computes are kept in the runner under short ids
 * ("s1", "h1") so the model can chart them without copying numbers: the
 * chart resolver (lib/aiChart.js) draws the stored values.
 */

const DAY = 86400000;
const MAX_ROWS_OUT = 40;
const MAX_VISITS_OUT = 60;
const GAME_TYPES = ["x01", "cricket", "baseball", "aroundTheClock", "killer", "shanghai", "halveit", "gotcha", "tictactoe", "bobs27", "checkoutDrill", "scoringDrill"];
const METRICS = ["elo", "winPct", "x01Avg", "first9", "checkoutPct", "checkoutChances", "tons", "one80s", "busts", "highestTurn", "mpr", "baseballRuns", "games", "wins"];

const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const common = {
  player: str("Player name or @handle. Defaults to the signed-in player."),
  gameType: str("Game mode filter.", { enum: GAME_TYPES }),
  from: str("Start date, YYYY-MM-DD (inclusive)."),
  to: str("End date, YYYY-MM-DD (inclusive)."),
};

/** JSON-schema tool declarations, shared by every provider adapter. */
export const TOOL_DEFS = [
  {
    name: "query_games",
    description: "List individual ranked games (newest first) with per-game numbers: result, opponents, 3-dart avg, first 9, checkout, checkout chances, tons, MPR, runs, Elo after. Filter by player, opponent, mode, dates and result. Set includePractice for solo, bot and drill games.",
    parameters: {
      type: "object",
      properties: {
        ...common,
        opponent: str("Only games against this opponent (name or @handle)."),
        result: str("Only wins or only losses.", { enum: ["win", "loss"] }),
        includePractice: { type: "boolean", description: "Include practice games (solo, vs bots, drills)." },
        limit: { type: "integer", description: "Max games to return (default 15, max 40)." },
      },
    },
  },
  {
    name: "get_stats",
    description: "Career-style totals for a player, optionally for one game mode and/or a date range: games, wins, win %, streaks, and the detailed per-mode career numbers (X01 averages, checkout %, cricket MPR, baseball runs, and so on).",
    parameters: { type: "object", properties: { ...common } },
  },
  {
    name: "head_to_head",
    description: "Full record between a player and one opponent: wins, losses, games won by someone else, per game mode, current streak and the last five meetings with game ids.",
    parameters: { type: "object", properties: { ...common, opponent: str("The opponent (name or @handle).") }, required: ["opponent"] },
  },
  {
    name: "analyze_game",
    description: "Dart-by-dart analysis of one game for every player in it: visit scores, remaining score, legs, checkout chances and hits, busts, marks per round, misses. Use gameId from query_games, or which='last' for the player's most recent game. Returns chartable series ids.",
    parameters: {
      type: "object",
      properties: {
        gameId: str("The game id (from query_games or head_to_head)."),
        which: str("'last' for the player's most recent game.", { enum: ["last"] }),
        player: common.player,
        gameType: common.gameType,
      },
    },
  },
  {
    name: "get_series",
    description: "Compute a trend for a player as a chartable series: one metric grouped per game, week or month, with optional mode, opponent and date filters. Returns a series id to use in a chart block, plus the values. Call it once per player to compare players on one chart.",
    parameters: {
      type: "object",
      properties: {
        ...common,
        metric: str("What to measure.", { enum: METRICS }),
        groupBy: str("Group per game, week or month (default month).", { enum: ["game", "week", "month"] }),
        opponent: str("Only games against this opponent."),
        last: { type: "integer", description: "Keep only the most recent N points." },
      },
      required: ["metric"],
    },
  },
  {
    name: "dart_heatmap",
    description:
      "Which beds a player's logged darts hit: counts per board number and ring (single, double, treble, bull), from the beds tapped when scoring. " +
      "Singles are one count (the log doesn't say inner or outer single). Misses are only 'missed the board' in X01; in target games (baseball, cricket, " +
      "around the clock, shanghai and so on) a logged miss means the dart missed that game's target, and where it landed isn't recorded. " +
      "Returns a heatmap id for a chart block of type heatmap, plus missMeaning to quote correctly.",
    parameters: { type: "object", properties: { ...common } },
  },
];

function dayStart(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getTime() : null;
}

/**
 * @param {object} o
 * @param {object[]} o.rows    camelCase game_results rows (lib/practice.js resultFromRow)
 * @param {object[]} o.players [{ username, handle }]
 * @param {string}   o.me      the signed-in player's name
 */
export function createToolRunner({ rows, players = [], me, now = new Date() }) {
  const all = (rows || []).slice().sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const series = {};
  const heatmaps = {};
  let sn = 0;
  let hn = 0;

  const byHandle = new Map();
  for (const p of players) {
    byHandle.set(String(p.username).toLowerCase(), p.username);
    if (p.handle) byHandle.set(String(p.handle).toLowerCase(), p.username);
  }
  for (const r of all) byHandle.set(String(r.username).toLowerCase(), r.username);
  const resolve = (name, fallback = me) => {
    if (!name) return fallback;
    const k = String(name).trim().replace(/^@/, "").toLowerCase();
    if (byHandle.has(k)) return byHandle.get(k);
    // a first name is enough
    const hit = [...byHandle.values()].find((u) => String(u).toLowerCase().startsWith(k));
    return hit || String(name).trim();
  };

  const filterRows = ({ player, gameType, from, to, opponent, result, includePractice }) => {
    const u = resolve(player);
    const opp = opponent ? resolve(opponent, null) : null;
    const f = dayStart(from);
    const t = dayStart(to);
    return {
      u,
      opp,
      list: all.filter((r) => {
        if (r.username !== u) return false;
        if (!includePractice && r.result === "practice") return false;
        if (gameType && r.gameType !== gameType) return false;
        if (opp && !(r.opponents || []).includes(opp)) return false;
        if (result && r.result !== result) return false;
        const ts = new Date(r.completedAt).getTime();
        if (f != null && ts < f) return false;
        if (t != null && ts >= t + DAY) return false;
        return true;
      }),
    };
  };

  const compact = (r, u) => {
    const { _rp, logged, ...g } = describeGame(r, u);
    return { gameId: r.gameId, ...g, opponents: (g.opponents || []).map(playerLabel) };
  };

  const tools = {
    query_games(a = {}) {
      const { u, list } = filterRows(a);
      const limit = Math.max(1, Math.min(MAX_ROWS_OUT, parseInt(a.limit, 10) || 15));
      return { player: u, matched: list.length, games: list.slice(-limit).reverse().map((r) => compact(r, u)) };
    },

    get_stats(a = {}) {
      const { u, list } = filterRows(a);
      if (!list.length) return { player: u, games: 0, note: "No ranked games match." };
      const s = computeStats(list)[u];
      const career = computeCareer({ results: list, practice: [] }, u);
      const strip = (c) => {
        if (!c) return null;
        const { series: _s, ...rest } = c;
        return rest;
      };
      return {
        player: u,
        games: s.games,
        wins: s.wins,
        losses: s.games - s.wins,
        winPct: round(s.winPct, 1),
        currentWinStreak: s.winStreak,
        bestWinStreak: s.bestWinStreak,
        lastFive: s.lastFive,
        firstGame: list[0].completedAt.slice(0, 10),
        lastGame: list[list.length - 1].completedAt.slice(0, 10),
        byMode: a.gameType ? { [a.gameType]: strip(career[a.gameType]) } : Object.fromEntries(Object.entries(career).map(([k, v]) => [k, strip(v)])),
      };
    },

    head_to_head(a = {}) {
      const { u, opp, list } = filterRows({ ...a, opponent: a.opponent });
      if (!opp) return { error: "Name an opponent." };
      const rv = rivalry(list, u, opp);
      return {
        player: u,
        opponent: opp,
        games: rv.games,
        wins: rv.wins,
        losses: rv.losses,
        otherWinner: rv.otherWinner,
        winPct: rv.winPct,
        byGameType: rv.byGameType,
        streak: rv.streak,
        last5: rv.last5.map((m) => ({ date: String(m.date).slice(0, 10), game: m.gameType, result: m.result, winner: m.winner, gameId: m.gameId })),
      };
    },

    analyze_game(a = {}) {
      let gameId = a.gameId;
      if (!gameId) {
        const { list } = filterRows({ player: a.player, gameType: a.gameType, includePractice: true });
        gameId = list[list.length - 1]?.gameId;
      }
      const gameRows = all.filter((r) => r.gameId === gameId);
      if (!gameRows.length) return { error: "Game not found (it may belong to players you can't see)." };
      return describeMatch(gameRows, register);
    },

    get_series(a = {}) {
      if (!METRICS.includes(a.metric)) return { error: `metric must be one of ${METRICS.join(", ")}` };
      const { u, list } = filterRows(a);
      const games = list.map((r) => describeGame(r, u));
      const pts = seriesFor(games, a.metric, a.groupBy || "month");
      const last = parseInt(a.last, 10);
      const points = last > 0 ? pts.slice(-last) : pts;
      if (!points.length) return { player: u, metric: a.metric, points: [], note: "No data for that." };
      const id = register(points, `${playerLabel(u)} ${a.metric}`);
      return { id, player: u, metric: a.metric, groupBy: a.groupBy || "month", points: points.map(({ x, y, label, date, n }) => ({ y, label: label || date, n })) };
    },

    dart_heatmap(a = {}) {
      const { u, list } = filterRows({ ...a, includePractice: true });
      const counts = {};
      let darts = 0;
      let misses = 0;
      const modes = new Set();
      for (const r of list) {
        const an = analyzeGame(r);
        if (!an.quality?.hasVisits) continue;
        modes.add(r.gameType);
        for (const d of an.darts || []) {
          darts++;
          if (!d.n || !d.mult) {
            misses++;
            continue;
          }
          const k = String(d.n);
          counts[k] = counts[k] || { S: 0, D: 0, T: 0 };
          counts[k][d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"]++;
        }
      }
      if (!darts) return { player: u, darts: 0, note: "No logged darts for that filter." };
      // only X01 logs a miss as "no score"; target games log "missed the target"
      const x01Only = modes.size === 1 && modes.has("x01");
      const missMeaning = x01Only ? "missed the board (scored nothing)" : "missed the target; where those darts landed isn't recorded";
      const id = `h${++hn}`;
      heatmaps[id] = { counts, darts, misses, player: u, missLabel: x01Only ? "missed the board" : "missed the target (spot not recorded)" };
      const top = Object.entries(counts)
        .map(([n, c]) => ({ segment: n, hits: c.S + c.D + c.T, ...c }))
        .sort((x, y) => y.hits - x.hits)
        .slice(0, 8);
      return { id, player: u, modes: [...modes], darts, misses, missPct: round((misses / darts) * 100, 1), missMeaning, topSegments: top };
    },
  };

  function register(points, name) {
    const id = `s${++sn}`;
    series[id] = { name, points };
    return id;
  }

  return {
    series,
    heatmaps,
    register,
    run(name, args) {
      const fn = tools[name];
      if (!fn) return { error: `Unknown tool ${name}` };
      try {
        return fn(args && typeof args === "object" ? args : {});
      } catch (e) {
        return { error: e?.message || "Tool failed" };
      }
    },
  };
}

/** One metric over a player's described games, per game or per period. */
export function seriesFor(games, metric, groupBy) {
  const x01 = games.filter((g) => g.game === "x01");
  const cricket = games.filter((g) => g.game === "cricket");
  if (groupBy === "game") {
    const pick = {
      elo: [games, (g) => g.eloAfter],
      x01Avg: [x01, (g) => g.threeDartAvg],
      first9: [x01, (g) => g.first9Avg],
      checkoutPct: [x01, (g) => (g.checkoutChances ? round((g.checkoutHit / g.checkoutChances) * 100) : null)],
      checkoutChances: [x01, (g) => g.checkoutChances],
      tons: [x01, (g) => g.tons],
      one80s: [x01, (g) => g.one80s],
      busts: [x01, (g) => g.busts],
      highestTurn: [x01, (g) => g.highestTurn || null],
      mpr: [cricket, (g) => g.mpr],
      baseballRuns: [games.filter((g) => g.game === "baseball"), (g) => g.runs],
      games: [games, () => 1],
      wins: [games, (g) => (g.result === "win" ? 1 : 0)],
    };
    if (metric === "winPct") return runningWinPct(games);
    const [list, fn] = pick[metric] || [games, () => null];
    return gameSeries(list, fn);
  }
  const buckets = bucketize(games, groupBy === "week" ? "week" : "month", 24);
  const field = { x01Avg: "threeDartAvg", first9: "first9Avg", checkoutPct: "checkoutPct", checkoutChances: "checkoutChances", tons: "tons", one80s: "one80s", busts: "busts", highestTurn: "highestCheckout", mpr: "mpr", games: "games", wins: "wins", winPct: "winPct" }[metric];
  if (metric === "elo") {
    // Elo at the end of each period
    const map = new Map();
    for (const g of games) if (g.eloAfter != null) map.set(periodKey(g.date, groupBy), { y: g.eloAfter, date: g.date });
    return [...map.entries()].map(([k, v], i) => ({ x: i + 1, y: v.y, date: k, label: k }));
  }
  if (metric === "baseballRuns") {
    const b = games.filter((g) => g.game === "baseball");
    const map = new Map();
    for (const g of b) {
      const k = periodKey(g.date, groupBy);
      const cur = map.get(k) || { s: 0, n: 0 };
      cur.s += g.runs || 0;
      cur.n++;
      map.set(k, cur);
    }
    return [...map.entries()].map(([k, v], i) => ({ x: i + 1, y: round(v.s / v.n, 1), date: k, label: k, n: v.n }));
  }
  const nKey = ["x01Avg", "first9", "tons", "one80s", "busts", "highestTurn"].includes(metric) ? "x01Games" : metric === "checkoutPct" ? "checkoutChances" : metric === "mpr" ? "cricketGames" : "games";
  return seriesFrom(buckets, field, nKey);
}

function periodKey(date, groupBy) {
  const d = String(date).slice(0, 10);
  return groupBy === "week" ? d : d.slice(0, 7);
}

/**
 * Condensed dart-by-dart view of one game for the model, plus chartable
 * series registered through `register(points, name)`.
 */
export function describeMatch(gameRows, register) {
  const m = analyzeMatch(gameRows);
  const out = {
    gameId: m.gameId,
    gameType: m.gameType,
    config: m.config,
    winner: playerLabel(m.winner),
    date: String(m.completedAt || "").slice(0, 10),
    players: {},
    chartableSeries: [],
  };
  const byKey = {};
  for (const [u, a] of Object.entries(m.players)) {
    const visits = (a.visits || []).slice(0, MAX_VISITS_OUT).map((v, i) => ({
      n: i + 1,
      leg: (v.r || 0) + 1,
      darts: (v.darts || []).map((d) => (d.n ? `${d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"}${d.n}` : "Miss")).join(" "),
      scored: v.out?.s ?? null,
      left: v.out?.rem ?? null,
      bust: v.out?.k === "bust" || undefined,
    }));
    out.players[u] = {
      won: a.won,
      logged: a.quality?.hasVisits,
      metrics: a.metrics,
      rounds: (a.rounds || []).slice(0, 25),
      visits: visits.length ? visits : undefined,
      notes: a.quality?.notes?.length ? a.quality.notes : undefined,
    };
    for (const [k, pts] of Object.entries(a.series || {})) {
      if (!Array.isArray(pts) || !pts.length) continue;
      (byKey[k] = byKey[k] || []).push({ u, pts });
    }
  }
  if (register) {
    for (const [k, list] of Object.entries(byKey)) {
      const ids = list.map(({ u, pts }) => register(pts, `${playerLabel(u)}`));
      out.chartableSeries.push({ metric: k, ids, players: list.map((x) => playerLabel(x.u)) });
    }
  }
  return out;
}


/**
 * Data for the weekly report card: the player's last 7 days against the 7
 * before, the week's games, and chartable series. Null when the player
 * hasn't played a ranked game in the last 7 days.
 */
export function weeklyData({ rows, me, now = new Date(), register }) {
  const t = now.getTime();
  const mine = (rows || [])
    .filter((r) => r.username === me && r.result !== "practice")
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const age = (r) => t - new Date(r.completedAt).getTime();
  const week = mine.filter((r) => age(r) >= 0 && age(r) <= 7 * DAY);
  if (!week.length) return null;
  const prev = mine.filter((r) => age(r) > 7 * DAY && age(r) <= 14 * DAY);
  const wk = week.map((r) => describeGame(r, me));
  const pv = prev.map((r) => describeGame(r, me));
  const eloStart = mine.filter((r) => age(r) > 7 * DAY).slice(-1)[0]?.eloAfter ?? null;
  const opponents = {};
  for (const g of wk) for (const o of g.opponents || []) {
    const k = playerLabel(o);
    opponents[k] = opponents[k] || { games: 0, wins: 0 };
    opponents[k].games++;
    if (g.result === "win") opponents[k].wins++;
  }
  const charts = [];
  if (register) {
    const elo = gameSeries(wk, (g) => g.eloAfter);
    if (elo.length > 1) charts.push({ id: register(elo, "Elo"), what: "Elo after each game this week" });
    const avg = gameSeries(wk.filter((g) => g.game === "x01"), (g) => g.threeDartAvg);
    if (avg.length > 1) charts.push({ id: register(avg, "3-dart avg"), what: "X01 3-dart average per game this week" });
    const mpr = gameSeries(wk.filter((g) => g.game === "cricket"), (g) => g.mpr);
    if (mpr.length > 1) charts.push({ id: register(mpr, "MPR"), what: "Cricket MPR per game this week" });
  }
  const strip = ({ _rp, logged, ...g }) => ({ ...g, opponents: (g.opponents || []).map(playerLabel) });
  return {
    player: me,
    from: new Date(t - 7 * DAY).toISOString().slice(0, 10),
    to: new Date(t).toISOString().slice(0, 10),
    thisWeek: summarise(wk),
    previousWeek: prev.length ? summarise(pv) : null,
    eloChange: eloStart != null && wk[wk.length - 1].eloAfter != null ? Math.round(wk[wk.length - 1].eloAfter - eloStart) : null,
    opponents,
    games: wk.map(strip),
    chartableSeries: charts,
  };
}

const METRIC_WORDS = { elo: "Elo", winPct: "win %", x01Avg: "3-dart average", first9: "first-9 average", checkoutPct: "checkout %", checkoutChances: "checkout chances", tons: "tons", one80s: "180s", busts: "busts", highestTurn: "best visits", mpr: "cricket MPR", baseballRuns: "baseball runs", games: "games", wins: "wins" };
const MODE_WORDS = { x01: "X01", cricket: "cricket", baseball: "baseball", aroundTheClock: "Around the Clock", killer: "Killer", shanghai: "Shanghai", halveit: "Halve It", gotcha: "Gotcha", tictactoe: "Tic-Tac-Toe" };

/** The line the chat shows while a tool runs. */
export function toolStatus(name, a = {}) {
  const mode = a.gameType ? `${MODE_WORDS[a.gameType] || a.gameType} ` : "";
  const who = a.player ? `${a.player}'s` : "your";
  switch (name) {
    case "query_games":
      return a.opponent ? `Looking up ${who} games vs ${a.opponent}…` : `Looking up ${who} ${mode}games…`;
    case "get_stats":
      return `Pulling ${who} ${mode}stats…`;
    case "head_to_head":
      return `Checking ${who} record vs ${a.opponent || "that opponent"}…`;
    case "analyze_game":
      return "Analyzing the game dart by dart…";
    case "get_series":
      return `Working out ${who} ${METRIC_WORDS[a.metric] || a.metric || "numbers"} by ${a.groupBy || "month"}…`;
    case "dart_heatmap":
      return `Mapping where ${who} darts land…`;
    default:
      return "Crunching the numbers…";
  }
}
