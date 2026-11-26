import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RECORD_GAME_KEYS, recordGamePayload } from "../lib/saveGame.js";
import { buildResultRows } from "../lib/practice.js";

// The save that broke for a month (Oct 25 – Nov 26, 2026) broke because the
// database and the app disagreed about how a game is saved. These tests pin
// the two together: the keys the SQL function reads, the keys the app sends,
// and the fact that the app calls the function at all.
const sql = readFileSync(new URL("../supabase/migration-record-game.sql", import.meta.url), "utf8");
const db = readFileSync(new URL("../lib/db.js", import.meta.url), "utf8");

test("the app sends exactly the keys record_game reads", () => {
  const read = [...new Set([...sql.matchAll(/p_game->>?'([a-z_]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(read, [...RECORD_GAME_KEYS].sort());
  const rows = buildResultRows({ gameId: "00000000-0000-4000-8000-000000000001", gameType: "x01", config: { startScore: 501 }, players: ["Ann", "bot:rook"], winner: "Ann", perPlayer: { Ann: { dartsThrown: 30 }, "bot:rook": { dartsThrown: 33 } }, ranked: false, currentElo: { Ann: 1000 }, completedAt: "2026-11-01T20:00:00Z" });
  const p = recordGamePayload({ gameId: "00000000-0000-4000-8000-000000000001", gameType: "x01", config: { startScore: 501 }, players: ["Ann", "bot:rook"], winner: "Ann", completedAt: "2026-11-01T20:00:00Z", rows });
  assert.deepEqual(Object.keys(p).sort(), [...RECORD_GAME_KEYS].sort());
  assert.deepEqual(Object.keys(p.stats), ["Ann"], "stats travel per human player; the bot rides inside");
  assert.equal(p.stats.Ann.botStats["bot:rook"].dartsThrown, 33);
});

test("record_game takes one jsonb argument named p_game, and the app calls it that way", () => {
  assert.match(sql, /function\s+(public\.)?record_game\s*\(\s*p_game\s+jsonb\s*\)/i);
  assert.match(db, /supabase\.rpc\("record_game",\s*\{\s*p_game:/);
});

test("direct inserts into game_results are closed by the migration, so the app must not rely on them", () => {
  // if a future migration reopens or renames this, the app's save path needs a fresh look
  assert.match(sql, /drop policy if exists "members add results" on game_results/);
});
