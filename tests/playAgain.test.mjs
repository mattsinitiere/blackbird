import { test } from "node:test";
import assert from "node:assert/strict";
import { lastGameFor, playAgainLabel, currentStreak, firstThrowLabel } from "../lib/playAgain.js";
import { rematchGame, nextThrowOrder } from "../lib/games.js";

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

test("Play Again keeps the winner so the next order can be worked out", () => {
  const g = lastGameFor([{ username: "Matt", gameType: "x01", config: {}, opponents: ["Chuck"], winner: "Matt", completedAt: "2026-09-01T10:00:00Z" }], "Matt");
  assert.equal(g.winner, "Matt");
  const next = rematchGame(g, { winner: g.winner });
  assert.deepEqual(next.players, ["Chuck", "Matt"]);
  assert.equal(firstThrowLabel(next.players, "Matt"), "Chuck throws first");
  assert.equal(firstThrowLabel(["Matt", "bot:raven"], "Matt"), "You throw first");
  assert.equal(firstThrowLabel(["bot:raven", "Matt"], "Matt"), "Raven throws first");
  assert.equal(firstThrowLabel(["Matt"], "Matt"), "");
});

test("rematch moves the throw on: the loser starts, or the table rotates", () => {
  assert.deepEqual(nextThrowOrder(["A", "B"], "A"), ["B", "A"]);
  assert.deepEqual(nextThrowOrder(["A", "B"], "B"), ["A", "B"]);
  assert.deepEqual(nextThrowOrder(["A", "B"], null), ["B", "A"]);
  assert.deepEqual(nextThrowOrder(["A", "B", "C"], "B"), ["B", "C", "A"]);
  assert.deepEqual(nextThrowOrder(["A"], "A"), ["A"]);
  const game = { id: "x", gameType: "killer", config: { lives: 3 }, players: ["A", "B", "C"] };
  const r = rematchGame(game, { winner: "A" });
  assert.deepEqual(r.players, ["B", "C", "A"]);
  assert.notEqual(r.id, "x");
  assert.deepEqual(Object.keys(r.config.numbers).sort(), ["A", "B", "C"]);
  assert.deepEqual(rematchGame(game, { keepOrder: true }).players, ["A", "B", "C"]);
  assert.deepEqual(game.players, ["A", "B", "C"]); // the old game is untouched
});

test("currentStreak reads the trailing run", () => {
  assert.equal(currentStreak(["L", "W", "W", "W"]), "W3");
  assert.equal(currentStreak(["W", "L", "L"]), "L2");
  assert.equal(currentStreak([]), null);
});
