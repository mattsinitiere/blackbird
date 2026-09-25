import { test } from "node:test";
import assert from "node:assert/strict";
import { isRankedMatch, buildResultRows, splitResults, humanPlayers, PRACTICE_ONLY } from "../lib/practice.js";
import { isBot, playerLabel } from "../lib/bots.js";

test("isRankedMatch: two humans in a competitive game", () => {
  assert.equal(isRankedMatch({ gameType: "x01", players: ["Ann", "Bob"] }), true);
  assert.equal(isRankedMatch({ gameType: "cricket", players: ["Ann", "Bob", "Cy"] }), true);
});

test("isRankedMatch: solo, bot and drill games are practice", () => {
  assert.equal(isRankedMatch({ gameType: "x01", players: ["Ann"] }), false);
  assert.equal(isRankedMatch({ gameType: "x01", players: ["Ann", "bot:rook"] }), false);
  assert.equal(isRankedMatch({ gameType: "bobs27", players: ["Ann", "Bob"] }), false);
  for (const t of PRACTICE_ONLY) assert.equal(isRankedMatch({ gameType: t, players: ["Ann", "Bob"] }), false);
  assert.equal(isRankedMatch({}), false);
  assert.equal(isRankedMatch({ gameType: "x01", players: [] }), false);
});

test("bots: prefix detection and labels", () => {
  assert.equal(isBot("bot:rook"), true);
  assert.equal(isBot("Rook"), false);
  assert.equal(isBot(null), false);
  assert.equal(playerLabel("Ann"), "Ann");
  assert.equal(playerLabel("bot:rook"), "Rook");
  assert.deepEqual(humanPlayers(["Ann", "bot:rook", "Bob"]), ["Ann", "Bob"]);
});

const base = {
  gameId: "g1",
  gameType: "x01",
  config: { startScore: 501 },
  winner: "Bob",
  perPlayer: { Ann: { dartsThrown: 21 }, Bob: { dartsThrown: 18 } },
  completedAt: "2026-09-18T20:12:00.000Z",
};

test("buildResultRows: ranked game writes win/loss with new Elo", () => {
  const rows = buildResultRows({
    ...base,
    players: ["Ann", "Bob"],
    ranked: true,
    eloAfter: { Ann: 987.6, Bob: 1012.4 },
    currentElo: { Ann: 1000, Bob: 1000 },
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.username, r.result, r.elo_after]), [["Ann", "loss", 988], ["Bob", "win", 1012]]);
  assert.deepEqual(rows[0].opponents, ["Bob"]);
  assert.equal(rows[0].game_id, "g1");
  assert.equal(rows[0].game_type, "x01");
  assert.deepEqual(rows[0].stats, { dartsThrown: 21 });
  assert.equal(rows[0].completed_at, base.completedAt);
});

test("buildResultRows: solo game writes one practice row with Elo unchanged", () => {
  const rows = buildResultRows({
    ...base,
    players: ["Ann"],
    winner: "Ann",
    ranked: false,
    eloAfter: null,
    currentElo: { Ann: 1043 },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, "practice");
  assert.equal(rows[0].elo_after, 1043);
  assert.deepEqual(rows[0].opponents, []);
});

test("buildResultRows: bot games write only the human's row, bot as opponent", () => {
  const rows = buildResultRows({
    ...base,
    players: ["Ann", "bot:rook"],
    winner: "bot:rook",
    ranked: false,
    eloAfter: null,
    currentElo: {},
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, "Ann");
  assert.equal(rows[0].result, "practice");
  assert.equal(rows[0].winner, "bot:rook");
  assert.deepEqual(rows[0].opponents, ["bot:rook"]);
  assert.equal(rows[0].elo_after, 1000);
});

test("splitResults separates practice rows and keeps order", () => {
  const rows = [
    { id: 1, result: "win" },
    { id: 2, result: "practice" },
    { id: 3, result: "loss" },
    { id: 4, result: "practice" },
  ];
  const { competitive, practice } = splitResults(rows);
  assert.deepEqual(competitive.map((r) => r.id), [1, 3]);
  assert.deepEqual(practice.map((r) => r.id), [2, 4]);
  assert.deepEqual(splitResults(undefined), { competitive: [], practice: [] });
});

test("computePractice: counts, personal bests, trends and ladder", async () => {
  const { computePractice } = await import("../lib/practice.js");
  const me = "Matt";
  const day = (d) => `2026-09-${String(d).padStart(2, "0")}T20:00:00.000Z`;
  const rows = [
    { username: me, result: "practice", gameType: "bobs27", stats: { finalScore: 41 }, completedAt: day(1), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "bobs27", stats: { finalScore: 65 }, completedAt: day(10), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "checkoutDrill", stats: { hit: 3, dartsPerHit: 6 }, completedAt: day(11), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "checkoutDrill", stats: { hit: 3, dartsPerHit: 4.5 }, completedAt: day(12), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "scoringDrill", stats: { avgPerTurn: 52.3 }, completedAt: day(15), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "x01", stats: { pointsScored: 501, dartsThrown: 21 }, completedAt: day(16), opponents: [], winner: me },
    { username: me, result: "practice", gameType: "x01", stats: { pointsScored: 501, dartsThrown: 18 }, completedAt: day(17), opponents: ["bot:rook"], winner: me },
    { username: "Sam", result: "practice", gameType: "bobs27", stats: { finalScore: 99 }, completedAt: day(17), opponents: [], winner: "Sam" },
  ];
  const p = computePractice(rows, me, new Date("2026-09-18T12:00:00Z"));
  assert.equal(p.count, 7);
  assert.equal(p.thisWeek, 5);
  assert.equal(p.drills.bobs27.count, 2);
  assert.equal(p.drills.bobs27.pb.value, 65);
  assert.deepEqual(p.drills.bobs27.series.map((s) => s.y), [41, 65]);
  assert.equal(p.drills.checkoutDrill.pb.stats.dartsPerHit, 4.5, "tie on hits broken by fewer darts per hit");
  assert.equal(p.drills.scoringDrill.pb.value, 52.3);
  assert.equal(p.x01.count, 2);
  assert.equal(p.x01.bestAvg, 83.5);
  assert.deepEqual(p.bots, { ...p.bots, games: 1, wins: 1, level: 2 });
  assert.equal(p.recent[0].completedAt, day(17));
  assert.equal(p.recent.length, 7);
});

test("newlyUnlockedBot: the bot a win opens, and nothing otherwise", async () => {
  const { botLadder, newlyUnlockedBot } = await import("../lib/practice.js");
  const { BOTS } = await import("../lib/bots.js");
  const row = (winner) => ({ username: "Ann", opponents: [BOTS[0].id], winner, result: "practice", completedAt: "2026-09-01T00:00:00Z" });
  const before = botLadder([row(BOTS[0].id)], "Ann");
  const afterWin = botLadder([row(BOTS[0].id), row("Ann")], "Ann");
  assert.equal(newlyUnlockedBot(before, afterWin)?.id, BOTS[1].id);
  const afterLoss = botLadder([row(BOTS[0].id), row(BOTS[0].id)], "Ann");
  assert.equal(newlyUnlockedBot(before, afterLoss), null);
  assert.equal(newlyUnlockedBot(afterWin, botLadder([row("Ann"), row("Ann")], "Ann")), null, "beating it again unlocks nothing new");
});
