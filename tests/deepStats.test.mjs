import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareGames, gameTypesPlayed, landingHeatmap, dartByDart, paceOfPlay, whenPlayed, underPressure, x01Opponents, rivalryTimelines, practiceVsRanked, botProgress, botClimb, rateZ, meanZ } from "../lib/deepStats.js";
import { practiceAsMatches } from "../lib/practiceStats.js";
import { computeCareer } from "../lib/gamestats/career.js";

let n = 0;
const at = (day, hour = 20) => new Date(Date.UTC(2026, 8, day, hour)).toISOString();
const utc = (iso) => {
  const d = new Date(iso);
  return { day: (d.getUTCDay() + 6) % 7, hour: d.getUTCHours() };
};
const row = (gameType, result, stats, extra = {}) => ({
  gameId: `g${++n}`,
  username: "Ann",
  gameType,
  config: gameType === "x01" ? { startScore: 101, doubleOut: true } : {},
  winner: result === "win" ? "Ann" : "Bob",
  result,
  opponents: ["Bob"],
  stats,
  completedAt: at(1 + n),
  ...extra,
});
const M = { n: 0, mult: 0 };
// a nine-inning baseball row: `runs[i]` singles in inning i, the rest misses
const baseballStats = (runs, { v2 = false, secPerTurn = 60 } = {}) => {
  const visits = runs.map((r, i) => ({ i, r: i, s0: 0, darts: [0, 1, 2].map((k) => ({ ...(k < r ? { n: i + 1, mult: 1 } : M), ...(v2 ? { t: (i + 1) * secPerTurn * 1000 + k * 300 } : {}) })), out: { runs: r } }));
  const darts = visits.flatMap((v) => v.darts.map((d) => ({ n: d.n, mult: d.mult })));
  const total = runs.reduce((a, b) => a + b, 0);
  return v2 ? { v: 2, runs: total, innings: runs, darts, dartsThrown: 27, visits, durationMs: 9 * secPerTurn * 1000 } : { runs: total, darts, dartsThrown: 27 };
};

test("prepareGames: one player's matches, oldest first; practice rows are refused until recast", () => {
  const rows = [row("baseball", "win", baseballStats([1, 1, 1, 0, 0, 0, 2, 2, 2])), row("baseball", "practice", baseballStats([1, 0, 0, 0, 0, 0, 0, 0, 0]), { opponents: ["bot:jay"], winner: "Ann" }), { ...row("baseball", "loss", {}), username: "Bob" }];
  const games = prepareGames(rows, "Ann");
  assert.equal(games.length, 1);
  assert.equal(games[0].won, true);
  const practice = prepareGames(practiceAsMatches(rows, "Ann"), "Ann");
  assert.equal(practice.length, 1);
  assert.equal(practice[0].won, true);
  assert.deepEqual(gameTypesPlayed(games), [{ gameType: "baseball", games: 1 }]);
});

test("landingHeatmap: beds from every game, legacy rows too; misses beside the board", () => {
  const games = prepareGames([row("baseball", "win", baseballStats([3, 0, 0, 0, 0, 0, 0, 0, 1])), row("baseball", "loss", baseballStats([1, 0, 0, 0, 0, 0, 0, 0, 0], { v2: true }))], "Ann");
  const h = landingHeatmap(games);
  assert.equal(h.games, 2);
  assert.equal(h.darts, 54);
  assert.equal(h.misses, 49);
  assert.deepEqual(h.cells["1"], { S: 4, D: 0, T: 0 });
  assert.deepEqual(h.cells["9"], { S: 1, D: 0, T: 0 });
  assert.deepEqual(h.top, { label: "S1", darts: 4 });
  assert.equal(h.missKind, "target", "a Baseball miss is off the target number, not off the board");
  assert.equal(landingHeatmap(games, "x01").darts, 0);
  const x01 = { v: 2, dartsThrown: 3, pointsScored: 60, visits: [{ i: 0, r: 0, s0: 101, darts: [{ n: 20, mult: 3 }, M, M], out: { k: "score", s: 60, rem: 41 } }] };
  const xh = landingHeatmap(prepareGames([row("x01", "win", x01)], "Ann"));
  assert.equal(xh.misses, 2);
  assert.equal(xh.missKind, "board");
});

test("dartByDart: on-target rate per dart in target games, points per dart in X01", () => {
  const x01 = { v: 2, dartsThrown: 6, pointsScored: 101, visits: [
    { i: 0, r: 0, s0: 101, darts: [{ n: 20, mult: 3 }, { n: 1, mult: 1 }, { n: 20, mult: 1 }], out: { k: "score", s: 81, rem: 20 } },
    { i: 1, r: 0, s0: 20, darts: [{ n: 0, mult: 0 }, { n: 5, mult: 1 }, M], out: { k: "bust", s: 0, rem: 20 } },
  ] };
  // baseballStats puts the hits on the first darts: 9/9, 3/9, 0/9
  const games = prepareGames([row("baseball", "win", baseballStats([1, 1, 1, 1, 1, 1, 2, 2, 2])), row("x01", "loss", x01)], "Ann");
  const d = dartByDart(games);
  assert.deepEqual(d.target.positions.map((p) => p.pct), [100, 33.3, 0]);
  assert.equal(d.target.games, 1);
  assert.deepEqual(d.scoring.positions.map((p) => p.avg), [30, 3, 10]);
  assert.equal(dartByDart(games, "x01").target, null);
  assert.equal(dartByDart([]).scoring, null);
  assert.equal(d.target.verdict, null, "one game is too few to name a best dart");
});

test("dartByDart: names a best and worst dart only for a real gap", () => {
  const many = (runs, k = 5) => prepareGames(Array.from({ length: k }, () => row("baseball", "win", baseballStats(runs))), "Ann");
  // 45/45, 15/45, 0/45 over five games: a real difference
  assert.deepEqual(dartByDart(many([1, 1, 1, 1, 1, 1, 2, 2, 2])).target.verdict, { best: 0, worst: 2 });
  // the same split over four games: not enough games
  assert.equal(dartByDart(many([1, 1, 1, 1, 1, 1, 2, 2, 2], 4)).target.verdict, null);
  // every dart on target: nothing to choose between them
  assert.equal(dartByDart(many([3, 3, 3, 3, 3, 3, 3, 3, 3])).target.verdict, null);
});

test("rateZ and meanZ: about 2 for a borderline gap, 0 with nothing to compare", () => {
  assert.equal(rateZ(52, 100, 51, 100) < 2, true, "52% against 51% is noise");
  assert.equal(rateZ(600, 1000, 500, 1000) > 2, true);
  assert.equal(rateZ(1, 0, 1, 10), 0);
  const a = { n: 30, sum: 30 * 15, sq: 30 * (15 * 15 + 100) };
  const b = { n: 30, sum: 30 * 14.5, sq: 30 * (14.5 * 14.5 + 100) };
  assert.equal(Math.abs(meanZ(a, b)) < 2, true, "half a point a dart with a spread of 10 is noise");
  assert.equal(meanZ({ n: 1, sum: 5, sq: 25 }, b), 0);
});

test("paceOfPlay: only timed games; quick and slow halves once there are enough", () => {
  const rows = [];
  // six timed games: the three quick ones score 9 runs and win, the slow ones 3 and lose
  for (let i = 0; i < 3; i++) rows.push(row("baseball", "win", baseballStats([1, 1, 1, 1, 1, 1, 1, 1, 1], { v2: true, secPerTurn: 40 })));
  for (let i = 0; i < 3; i++) rows.push(row("baseball", "loss", baseballStats([1, 1, 1, 0, 0, 0, 0, 0, 0], { v2: true, secPerTurn: 100 })));
  rows.push(row("baseball", "win", baseballStats([0, 0, 0, 0, 0, 0, 0, 0, 0]))); // legacy: no timing
  const p = paceOfPlay(prepareGames(rows, "Ann"));
  assert.equal(p.total, 7);
  assert.equal(p.timed, 6);
  const b = p.modes[0];
  assert.equal(b.gameType, "baseball");
  assert.equal(b.avgMinutes, 10.5);
  assert.equal(b.secPerTurn, 70);
  assert.deepEqual(b.quick, { games: 3, winPct: 100, metric: 9, secPerTurn: 40 });
  assert.deepEqual(b.slow, { games: 3, winPct: 0, metric: 3, secPerTurn: 100 });
  const few = paceOfPlay(prepareGames(rows.slice(0, 5), "Ann"));
  assert.equal(few.modes[0].quick, null, "five timed games are too few to split");
  assert.equal(paceOfPlay(prepareGames([rows[6]], "Ann")).timed, 0);
});

test("whenPlayed: games and win rate by day and block; solo practice is never a result", () => {
  const b = baseballStats([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  // 2026-09-04 is a Friday, 2026-09-08 a Tuesday
  const rows = [
    ...[0, 1, 2, 3, 4].map(() => row("baseball", "win", b, { completedAt: at(4, 21) })),
    row("baseball", "win", b, { completedAt: at(4, 22) }),
    ...[0, 1, 2, 3, 4, 5].map((i) => row("baseball", i ? "loss" : "win", b, { completedAt: at(8, 19) })),
    row("baseball", "solo", b, { completedAt: at(8, 19) }),
  ];
  const w = whenPlayed(prepareGames(rows, "Ann"), null, utc);
  assert.equal(w.total, 13);
  assert.deepEqual(w.grid[4][7], { games: 6, decided: 6, wins: 6, winPct: 100 });
  assert.deepEqual(w.grid[1][6], { games: 7, decided: 6, wins: 1, winPct: 16.7 });
  assert.equal(w.max, 7);
  assert.equal(w.bestDay.label, "Fri");
  assert.equal(w.worstDay.label, "Tue");
  assert.equal(w.bestBlock.label, "9p");
  assert.equal(whenPlayed([], null, utc).bestDay, null);
});

test("whenPlayed: no best or worst from a handful of games or a small gap", () => {
  const b = baseballStats([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const games = (day, hour, wins, losses) => [...Array(wins).fill("win"), ...Array(losses).fill("loss")].map((r) => row("baseball", r, b, { completedAt: at(day, hour) }));
  // 3 of 3 against 0 of 3: too few games to rank a day at all
  let w = whenPlayed(prepareGames([...games(4, 21, 3, 0), ...games(8, 19, 0, 3)], "Ann"), null, utc);
  assert.equal(w.bestDay, null);
  assert.equal(w.worstDay, null);
  assert.equal(w.bestBlock, null);
  // 3 of 5 against 2 of 5: enough games, but the gap is luck
  w = whenPlayed(prepareGames([...games(4, 21, 3, 2), ...games(8, 19, 2, 3)], "Ann"), null, utc);
  assert.equal(w.bestDay, null);
  assert.equal(w.bestBlock, null);
});

test("underPressure: baseball early, middle and late innings over full games", () => {
  const games = prepareGames([row("baseball", "win", baseballStats([1, 1, 1, 2, 2, 2, 3, 3, 3])), row("baseball", "loss", baseballStats([1, 1, 1, 0, 0, 0, 1, 1, 1], { v2: true }))], "Ann");
  const u = underPressure(games);
  assert.deepEqual(u.baseball, { games: 2, early: 1, middle: 1, late: 2, trend: null }, "two games are too few for a verdict");
  const five = (runs) => prepareGames(Array.from({ length: 5 }, () => row("baseball", "win", baseballStats(runs))), "Ann");
  assert.equal(underPressure(five([0, 1, 0, 1, 1, 1, 2, 3, 2])).baseball.trend, "late");
  assert.equal(underPressure(five([2, 3, 2, 1, 1, 1, 0, 1, 0])).baseball.trend, "early");
  assert.equal(underPressure(five([1, 0, 1, 1, 1, 1, 1, 1, 0])).baseball.trend, null, "the same early and late");
  assert.equal(u.x01, null);
});

test("underPressure: X01 checkout % with an opponent on a finish and without", () => {
  const visit = (i, s0, darts, k, rem, t) => ({ i, r: 0, s0, darts: darts.map((d, j) => ({ ...d, t: t + j })), out: { k, s: k === "bust" ? 0 : s0 - rem, rem } });
  const D = (x) => ({ n: x, mult: 2 });
  // Ann starts on 40 and misses the double three times while Bob still has 301;
  // Bob then drops to 100; Ann misses twice more, then hits
  const ann = { v: 2, dartsThrown: 6, pointsScored: 40, visits: [visit(0, 40, [M, M, M], "score", 40, 1000), visit(1, 40, [M, M, D(20)], "win", 0, 3000)] };
  const bob = { v: 2, dartsThrown: 3, pointsScored: 201, visits: [visit(0, 301, [{ n: 20, mult: 3 }, { n: 20, mult: 3 }, { n: 19, mult: 3 }], "score", 124, 2000)] };
  const cfg = { startScore: 301, doubleOut: true };
  const a = { ...row("x01", "win", ann), config: cfg };
  const b = { ...a, username: "Bob", opponents: ["Ann"], result: "loss", stats: bob };
  const u = underPressure(prepareGames([a], "Ann"), x01Opponents([a, b], "Ann"));
  assert.deepEqual(u.x01.calm, { chances: 3, hits: 0, pct: 0 });
  assert.deepEqual(u.x01.pressure, { chances: 3, hits: 1, pct: 33.3 });
  assert.equal(u.x01.games, 1);
  // without the opponent's row there is nothing to measure against
  assert.equal(underPressure(prepareGames([a], "Ann"), x01Opponents([a], "Ann")).x01, null);
  // a bot's visits ride on the player's own row
  const vsBot = { ...a, gameId: "bot1", result: "win", opponents: ["bot:jay"], stats: { ...ann, botStats: { "bot:jay": bob } } };
  assert.equal(underPressure(prepareGames([vsBot], "Ann"), x01Opponents([vsBot], "Ann")).x01.pressure.hits, 1);
});

test("rivalryTimelines: running wins minus losses per human opponent", () => {
  const b = baseballStats([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const rows = [
    row("baseball", "win", b),
    row("baseball", "loss", b),
    row("baseball", "loss", b, { opponents: ["Bob", "Cat"], winner: "Cat" }),
    row("baseball", "win", b, { opponents: ["Cat"] }),
    row("baseball", "win", b, { opponents: ["bot:jay"] }),
  ];
  const [bob, cat] = rivalryTimelines(prepareGames(rows, "Ann"));
  assert.equal(bob.opponent, "Bob");
  assert.deepEqual([bob.games, bob.wins, bob.losses, bob.other], [3, 1, 1, 1]);
  assert.deepEqual(bob.points.map((p) => p.y), [1, 0, 0], "a third player's win moves nothing");
  assert.deepEqual(cat.points.map((p) => p.y), [-1, 0]);
  assert.equal(rivalryTimelines(prepareGames(rows, "Ann")).some((t) => t.opponent.startsWith("bot:")), false);
});

test("practiceVsRanked: both kinds of game on one weekly axis", () => {
  const b = (runs) => ({ runs, dartsThrown: 27 });
  const ranked = prepareGames([row("baseball", "win", b(8), { completedAt: at(1) }), row("baseball", "loss", b(10), { completedAt: at(2) }), row("baseball", "win", b(12), { completedAt: at(15) })], "Ann");
  const practice = prepareGames(practiceAsMatches([row("baseball", "practice", b(14), { completedAt: at(16), opponents: ["bot:jay"], winner: "Ann" })], "Ann"), "Ann");
  const [m] = practiceVsRanked(ranked, practice);
  assert.equal(m.gameType, "baseball");
  assert.equal(m.unit, "week");
  assert.equal(m.labels.length, 2);
  assert.deepEqual(m.ranked.points.map((p) => [p.x, p.y, p.n]), [[1, 9, 2], [2, 12, 1]]);
  assert.deepEqual(m.practice.points.map((p) => [p.x, p.y]), [[2, 14]]);
  assert.equal(m.ranked.overall, 10);
  assert.equal(m.practice.overall, 14);
  assert.deepEqual(practiceVsRanked(ranked, []), [], "a mode needs both");
});

test("botProgress: win % so far against each bot, in ladder order", () => {
  const b = { runs: 5 };
  const vs = (bot, won) => row("baseball", "practice", b, { opponents: [bot], winner: won ? "Ann" : bot });
  const practice = prepareGames(practiceAsMatches([vs("bot:jay", false), vs("bot:rook", true), vs("bot:jay", true), vs("bot:rook", true), vs("bot:jay", true), vs("bot:magpie", true), row("baseball", "practice", b, { opponents: [], winner: "Ann" })], "Ann"), "Ann");
  const bots = botProgress(practice);
  assert.deepEqual(bots.map((t) => t.bot), ["bot:rook", "bot:jay"], "Magpie has one game, so no line yet");
  assert.deepEqual(bots[1].points.map((p) => p.y), [0, 50, 67]);
  assert.equal(bots[1].winPct, 67);
  assert.equal(bots[0].name, "Rook");
});

test("botClimb: ladder order, the bot to work on, or the next one up", () => {
  const b = { runs: 5 };
  const vs = (bot, won) => row("baseball", "practice", b, { opponents: [bot], winner: won ? "Ann" : bot });
  const prep = (rows) => prepareGames(practiceAsMatches(rows, "Ann"), "Ann");
  // Rook beaten, Raven and Falcon not: Raven, the lower one, is the climb
  let c = botClimb(prep([vs("bot:falcon", false), vs("bot:raven", false), vs("bot:rook", true), vs("bot:raven", false), vs("bot:falcon", false)]));
  assert.deepEqual(c.bots.map((t) => [t.name, t.wins, t.losses]), [["Rook", 1, 0], ["Raven", 0, 2], ["Falcon", 0, 2]]);
  assert.equal(c.climbing.name, "Raven");
  assert.equal(c.next, null);
  // every bot played at 50% or better: the next bot above the highest
  c = botClimb(prep([vs("bot:rook", true), vs("bot:jay", true), vs("bot:jay", false)]));
  assert.equal(c.climbing, null);
  assert.equal(c.next.name, "Magpie");
  c = botClimb(prep([vs("bot:blackbird", true)]));
  assert.equal(c.next, null, "nothing above Blackbird");
  assert.deepEqual(botClimb([]).bots, []);
});

test("killer career carries per-game trend series", () => {
  const k = (lives, hitTurn) => ({ v: 2, dartsThrown: 6, livesRemaining: lives, isKiller: true, visits: [
    { i: 0, r: 0, s0: { l: 3, k: false }, darts: hitTurn === 0 ? [{ n: 5, mult: 2 }, M, M] : [M, M, M], out: { l: 3, k: hitTurn === 0, ev: 0 } },
    { i: 1, r: 1, s0: { l: 3, k: hitTurn === 0 }, darts: [{ n: 5, mult: 2 }, M, M], out: { l: lives, k: true, ev: 0 } },
  ], events: [{ t: "killer", by: "Ann", turn: 0 }, ...(lives ? [{ t: "elim", by: "Ann", on: "Bob", turn: 2 }] : [])] });
  const rows = [row("killer", "win", k(2, 0), { config: { numbers: { Ann: 5, Bob: 7 }, lives: 3 } }), row("killer", "loss", k(0, 1), { config: { numbers: { Ann: 5, Bob: 7 }, lives: 3 } })];
  const c = computeCareer({ results: rows, practice: [] }, "Ann").killer;
  assert.deepEqual(c.series.dartsToKiller.map((p) => p.y), [1, 4]);
  assert.deepEqual(c.series.livesLeft.map((p) => p.y), [2, 0]);
  assert.deepEqual(c.series.kills.map((p) => p.y), [1, 0]);
});
