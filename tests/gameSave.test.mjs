import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGameSave, planGameSave } from "../lib/gameSave.js";

const body = (extra = {}) => ({
  gameId: "da16fb84-99ea-42c6-a1ff-43b8c9f133fc",
  gameType: "x01",
  config: {},
  players: ["Matt", "Chuck"],
  winner: "Matt",
  perPlayer: {},
  completedAt: "2026-09-20T10:00:00Z",
  ...extra,
});
const plan = (extra = {}, opts = {}) =>
  planGameSave({ match: parseGameSave(body(extra)).match, callerUsername: "Matt", knownPlayers: ["Matt", "Chuck"], currentElo: { Matt: 1000, Chuck: 1000 }, ...opts });

test("parse rejects malformed saves", () => {
  assert.equal(parseGameSave(body()).ok, true);
  assert.equal(parseGameSave(body({ gameId: "nope" })).ok, false);
  assert.equal(parseGameSave(body({ players: [] })).ok, false);
  assert.equal(parseGameSave(body({ players: ["Matt", "Matt"] })).ok, false);
  assert.equal(parseGameSave(body({ winner: "Steve" })).ok, false);
  assert.equal(parseGameSave(body({ completedAt: "later" })).ok, false);
  assert.equal(parseGameSave(body({ completedAt: new Date(Date.now() + 86400000).toISOString() })).ok, false);
  assert.equal(parseGameSave(body({ perPlayer: [] })).ok, false);
});

test("only a player in the game can save it; the admin can save any", () => {
  assert.equal(plan({}, { callerUsername: "Gracie" }).status, 403);
  assert.equal(plan({}, { callerUsername: null }).status, 403);
  assert.equal(plan({}, { callerUsername: null, isAdmin: true }).ok, true);
});

test("every human player must exist", () => {
  const r = plan({ players: ["Matt", "Ghost"] }, { knownPlayers: ["Matt"] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
});

test("Elo comes from the stored ratings, not the client", () => {
  const r = plan({ eloAfter: { Matt: 5000, Chuck: 0 } }, { currentElo: { Matt: 1100, Chuck: 1000 } });
  assert.equal(r.ok, true);
  assert.ok(r.elo.Matt > 1100 && r.elo.Matt < 1120);
  assert.ok(r.elo.Chuck < 1000 && r.elo.Chuck > 980);
  for (const row of r.rows) assert.equal(row.elo_after, r.elo[row.username]);
  assert.deepEqual(r.rows.map((x) => x.result).sort(), ["loss", "win"]);
});

test("solo games are practice: rows but no Elo change", () => {
  const r = plan({ players: ["Matt"], winner: "Matt" }, { knownPlayers: ["Matt"] });
  assert.equal(r.ok, true);
  assert.equal(r.elo, null);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].result, "practice");
  assert.equal(r.rows[0].elo_after, 1000);
});

test("a ranked game without a winner is refused", () => {
  assert.equal(plan({ winner: null }).status, 400);
});
