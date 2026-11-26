import { test } from "node:test";
import assert from "node:assert/strict";
import { readPending, readParked, enqueuePending, flushPending, eloForLateSync, syncedMessage, pendingNote, MAX_ATTEMPTS } from "../lib/pendingGames.js";

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

test("Home says what's waiting, and confirms the sync with the Elo change", () => {
  assert.equal(pendingNote(0), "");
  assert.equal(pendingNote(1), "1 game saved on this phone, waiting to sync. Your Elo and record don't include it yet.");
  assert.equal(pendingNote(2), "2 games saved on this phone, waiting to sync. Your Elo and record don't include them yet.");
  assert.equal(syncedMessage(1, 1129.4, 1143.2), "1 game synced · Elo 1129 → 1143");
  assert.equal(syncedMessage(2, 1000, 1000), "2 games synced");
  assert.equal(syncedMessage(1, null, 1010), "1 game synced");
  assert.equal(syncedMessage(0, 1000, 1010), "");
});

test("a game the server refuses for good is parked and the queue moves on", async () => {
  const s = memStore();
  enqueuePending("u", { match: match("bad"), ranked: true }, s);
  enqueuePending("u", { match: match("good"), ranked: true }, s);
  const deps = {
    currentElo: async () => ({ Matt: 1000, Chuck: 1000 }),
    existingRows: async () => [],
    record: async (args) => {
      if (args.gameId === "bad") throw Object.assign(new Error("not allowed"), { code: "42501" });
    },
  };
  const r = await flushPending("u", deps, s);
  assert.deepEqual(r.saved, ["good"]);
  assert.deepEqual(r.parked, ["bad"]);
  assert.equal(r.left, 0);
  assert.equal(readParked("u", s)[0].match.gameId, "bad");
  assert.equal(readParked("u", s)[0].lastCode, "42501");
});

test("a game that keeps failing is parked after MAX_ATTEMPTS", async () => {
  const s = memStore();
  enqueuePending("u", { match: match("flaky"), ranked: false, attempts: MAX_ATTEMPTS - 1 }, s);
  const deps = { currentElo: async () => ({}), existingRows: async () => [], record: async () => { throw new Error("Failed to fetch"); } };
  const r = await flushPending("u", deps, s);
  assert.deepEqual(r.parked, ["flaky"]);
  assert.equal(readPending("u", s).length, 0);
});
