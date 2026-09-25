import { test } from "node:test";
import assert from "node:assert/strict";
import { winChance, defaultRival, tapeRows } from "../lib/matchup.js";

test("winChance is symmetric Elo expectation", () => {
  assert.equal(winChance(1000, 1000), 0.5);
  assert.ok(Math.abs(winChance(1200, 1000) + winChance(1000, 1200) - 1) < 1e-9);
  assert.ok(winChance(1200, 1000) > 0.75);
});

test("defaultRival picks my most-played human opponent", () => {
  const rows = [
    { username: "Matt", result: "win", opponents: ["Chuck"] },
    { username: "Matt", result: "loss", opponents: ["Chuck", "Gracie"] },
    { username: "Matt", result: "win", opponents: ["Gracie"] },
    { username: "Matt", result: "practice", opponents: ["Gracie"] },
    { username: "Matt", result: "practice", opponents: ["bot:raven"] },
    { username: "Chuck", result: "win", opponents: ["Gracie"] },
  ];
  assert.equal(defaultRival(rows, "Matt", ["Matt", "Chuck", "Gracie"]), "Chuck");
  assert.equal(defaultRival([], "Matt", ["Matt", "Gracie"]), "Gracie");
  assert.equal(defaultRival(rows, "Matt", ["Matt"]), null);
});

test("tapeRows shows only stats someone has, and marks the better side", () => {
  const sa = { games: 10, wins: 6, winPct: 60, bestWinStreak: 3, x01: { darts: 90, threeDartAvg: 45.2 }, cricket: { rounds: 0 }, baseball: { games: 0 } };
  const sb = { games: 4, wins: 1, winPct: 25, bestWinStreak: 1, x01: { darts: 0 }, cricket: { rounds: 10, mpr: 1.8 }, baseball: { games: 0 } };
  const rows = tapeRows(sa, sb, 1040, 980);
  const keys = rows.map((r) => r.key);
  assert.deepEqual(keys, ["elo", "winPct", "games", "avg", "mpr", "streak"]);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by.elo.better, "a");
  assert.equal(by.avg.a, "45.2");
  assert.equal(by.avg.b, "–");
  assert.equal(by.avg.better, null);
  assert.equal(by.winPct.a, "60%");
  // no games at all: just Elo
  assert.deepEqual(tapeRows(undefined, undefined, 1000, 1000).map((r) => r.key), ["elo"]);
  assert.equal(tapeRows(undefined, undefined, 1000, 1000)[0].better, null);
});
