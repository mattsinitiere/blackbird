import { test } from "node:test";
import assert from "node:assert/strict";
import { readPending, enqueuePending, flushPending, eloForLateSync } from "../lib/pendingGames.js";

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const match = (id, extra = {}) => ({ gameId: id, gameType: "x01", config: {}, players: ["Matt", "Chuck"], winner: "Matt", perPlayer: {}, completedAt: "2026-09-20T10:00:00Z", ...extra });

test("queue is per account and replaces by game id", () => {
  const s = memStore();
  enqueuePending("u1", { match: match("g1"), ranked: true }, s);
  enqueuePending("u1", { match: match("g1"), ranked: true }, s);
  enqueuePending("u2", { match: match("g2"), ranked: false }, s);
  assert.equal(readPending("u1", s).length, 1);
  assert.equal(readPending("u2", s).length, 1);
  assert.equal(readPending("u3", s).length, 0);
});

test("late sync recomputes Elo from the current server ratings", () => {
  const e = eloForLateSync({ match: match("g"), existingRows: [], currentElo: { Matt: 1100, Chuck: 1000 } });
  assert.ok(e.Matt > 1100 && e.Chuck < 1000);
  assert.ok(Math.abs(e.Matt - 1100 + (e.Chuck - 1000)) < 1e-9);
});

test("late sync reuses stored elo_after when the rows already exist", () => {
  const e = eloForLateSync({ match: match("g"), existingRows: [{ username: "Matt", elo_after: 1012 }, { username: "Chuck", elo_after: 988 }], currentElo: { Matt: 1012, Chuck: 988 } });
  assert.deepEqual(e, { Matt: 1012, Chuck: 988 });
});

test("flush sends oldest first, stops on failure, keeps the rest", async () => {
  const s = memStore();
  enqueuePending("u", { match: match("a"), ranked: true }, s);
  enqueuePending("u", { match: match("b"), ranked: false }, s);
  enqueuePending("u", { match: match("c"), ranked: true }, s);
  const sent = [];
  let online = true;
  const deps = {
    currentElo: async () => ({ Matt: 1000, Chuck: 1000 }),
    existingRows: async () => [],
    record: async (args) => {
      if (!online || args.gameId === "b") {
        online = false;
        throw new Error("Failed to fetch");
      }
      sent.push(args.gameId);
    },
  };
  const r1 = await flushPending("u", deps, s);
  assert.deepEqual(r1.saved, ["a"]);
  assert.equal(r1.left, 2);
  assert.equal(readPending("u", s)[0].attempts, 1);
  online = true;
  deps.record = async (args) => sent.push(args.gameId);
  const r2 = await flushPending("u", deps, s);
  assert.deepEqual(r2.saved, ["b", "c"]);
  assert.equal(readPending("u", s).length, 0);
  assert.deepEqual(sent, ["a", "b", "c"]);
});
