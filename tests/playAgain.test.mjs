import { test } from "node:test";
import assert from "node:assert/strict";
import { lastGameFor, playAgainLabel, currentStreak } from "../lib/playAgain.js";

const rows = [
  { username: "Matt", gameType: "x01", config: { startScore: 501 }, opponents: ["Chuck"], completedAt: "2026-09-01T10:00:00Z" },
  { username: "Matt", gameType: "baseball", config: {}, opponents: ["Chuck", "Gracie"], completedAt: "2026-09-03T10:00:00Z" },
  { username: "Chuck", gameType: "cricket", config: {}, opponents: ["Matt"], completedAt: "2026-09-05T10:00:00Z" },
];

test("lastGameFor picks my most recent game, me first", () => {
  const g = lastGameFor(rows, "Matt");
  assert.equal(g.gameType, "baseball");
  assert.deepEqual(g.players, ["Matt", "Chuck", "Gracie"]);
  assert.equal(lastGameFor(rows, "Nobody"), null);
  assert.equal(lastGameFor([], "Matt"), null);
});

test("playAgainLabel names the mode and opponents, bots by name", () => {
  assert.equal(playAgainLabel({ gameType: "baseball", players: ["Matt", "Chuck"] }), "Baseball vs Chuck");
  assert.equal(playAgainLabel({ gameType: "baseball", players: ["Matt", "Chuck", "Gracie"] }), "Baseball vs Chuck +1");
  assert.equal(playAgainLabel({ gameType: "x01", players: ["Matt", "bot:raven"] }), "X01 vs Raven");
  assert.equal(playAgainLabel({ gameType: "checkoutDrill", players: ["Matt"] }), "Checkout Drill");
  assert.equal(playAgainLabel(null), "");
});

test("currentStreak reads the trailing run", () => {
  assert.equal(currentStreak(["L", "W", "W", "W"]), "W3");
  assert.equal(currentStreak(["W", "L", "L"]), "L2");
  assert.equal(currentStreak([]), null);
});
