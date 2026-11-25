import { test } from "node:test";
import assert from "node:assert/strict";
import { practiceAsMatches, computePracticeStats, practiceCounts } from "../lib/practiceStats.js";
import { computeStats } from "../lib/stats.js";

let n = 0;
const row = (username, gameType, winner, opponents, stats = {}, extra = {}) => ({
  gameId: `p${++n}`,
  username,
  gameType,
  config: gameType === "x01" ? { startScore: 501, doubleOut: true } : {},
  winner,
  result: "practice",
  opponents,
  stats,
  eloAfter: 1040,
  completedAt: new Date(Date.UTC(2026, 8, 1 + n)).toISOString(),
  ...extra,
});

const practice = [
  row("Chuck", "baseball", "Chuck", ["bot:magpie"], { runs: 12, dartsThrown: 27 }),
  row("Chuck", "baseball", "bot:magpie", ["bot:magpie"], { runs: 6, dartsThrown: 27 }),
  row("Chuck", "baseball", "Chuck", ["bot:magpie"], { runs: 9, dartsThrown: 27 }),
  row("Chuck", "cricket", "Chuck", ["bot:raven"], { marks: 30, rounds: 12, pointsScored: 40 }),
  row("Chuck", "x01", "bot:raven", ["bot:raven"], { dartsThrown: 30, pointsScored: 400 }),
  row("Chuck", "x01", "Chuck", [], { dartsThrown: 30, pointsScored: 501, checkout: 40 }), // solo
  row("Chuck", "killer", "Chuck", ["bot:jay"], { dartsThrown: 21, livesRemaining: 2, isKiller: true }),
  row("Chuck", "bobs27", "Chuck", [], { finalScore: 61, doublesHit: 9 }),
  row("Lindsey", "baseball", "Lindsey", ["bot:rook"], { runs: 20 }),
];

test("practiceAsMatches: bot games are wins or losses, solo games are solo, drills are left out", () => {
  const rows = practiceAsMatches(practice, "Chuck");
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((r) => r.result), ["win", "loss", "win", "win", "loss", "solo", "win"]);
  assert.ok(rows.every((r) => r.username === "Chuck"));
  assert.equal(practice[0].result, "practice", "the stored rows are not touched");
  // ranked rows passed in by mistake never leak into practice
  assert.equal(practiceAsMatches([{ ...practice[0], result: "win" }], "Chuck").length, 0);
});

test("computePracticeStats: the record covers games with an opponent, the counts cover everything", () => {
  const p = computePracticeStats(practice, "Chuck");
  assert.equal(p.games, 7);
  assert.equal(p.drills, 1);
  assert.equal(p.stats.played, 7);
  assert.equal(p.stats.solo, 1);
  assert.equal(p.stats.games, 6, "six games against a bot");
  assert.equal(p.stats.wins, 4);
  assert.equal(Math.round(p.stats.winPct), 67);
  assert.deepEqual(p.stats.lastFive, ["L", "W", "W", "L", "W"], "the solo game is not a loss");
  assert.equal(p.stats.winStreak, 1);
  assert.equal(p.stats.bestWinStreak, 2);
  assert.equal("eloChange" in p.stats, false);
  // per-mode numbers use every game, solo included
  assert.equal(p.stats.baseball.games, 3);
  assert.equal(p.stats.baseball.runs, 27);
  assert.equal(p.stats.x01.games, 2);
  assert.equal(Math.round(p.stats.x01.threeDartAvg * 10) / 10, 45.1);
  assert.equal(p.stats.cricket.mpr, 2.5);
  assert.equal(p.stats.killer.games, 1);
  assert.equal(p.stats.killer.wins, 1);
});

test("computePracticeStats: charts, career cards and the record against each bot", () => {
  const p = computePracticeStats(practice, "Chuck");
  assert.equal(p.timeline.win.length, 6);
  assert.equal(p.timeline.win.at(-1).y, 67);
  assert.equal(p.timeline.avg.length, 2);
  assert.equal(p.timeline.mpr.length, 1);
  assert.deepEqual(p.bots, [
    { bot: "bot:magpie", games: 3, wins: 2, losses: 1 },
    { bot: "bot:raven", games: 2, wins: 1, losses: 1 },
    { bot: "bot:jay", games: 1, wins: 1, losses: 0 },
  ]);
  assert.equal(p.career.baseball.games, 3);
  assert.equal(p.career.baseball.wins, 2);
  assert.equal(p.career.x01.games, 2);
  assert.equal(p.career.x01.wins, 0, "the solo leg is not a win over anyone");
  assert.equal(p.career.x01.solo, 1);
  assert.equal(p.career.baseball.solo, undefined);
  assert.equal(p.career.killer.games, 1);
  assert.equal(p.career.bobs27.sessions, 1);
});

test("computePracticeStats: only drills gives cards but no record; nothing gives null", () => {
  const drillsOnly = computePracticeStats([practice[7]], "Chuck");
  assert.equal(drillsOnly.stats, null);
  assert.equal(drillsOnly.games, 0);
  assert.equal(drillsOnly.drills, 1);
  assert.ok(drillsOnly.career.bobs27);
  assert.equal(computePracticeStats([], "Chuck"), null);
  assert.equal(computePracticeStats(practice, "Nobody"), null);
  const soloOnly = computePracticeStats([practice[5]], "Chuck");
  assert.equal(soloOnly.stats.played, 1);
  assert.equal(soloOnly.stats.games, 0);
  assert.deepEqual(soloOnly.timeline.win, []);
});

test("practice never reaches the ranked numbers", () => {
  assert.deepEqual(computeStats(practice), {});
  assert.deepEqual(practiceCounts(practice, "Chuck"), { games: 7, drills: 1 });
  assert.deepEqual(practiceCounts(practice, "Lindsey"), { games: 1, drills: 0 });
});
