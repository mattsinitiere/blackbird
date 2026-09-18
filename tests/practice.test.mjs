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
