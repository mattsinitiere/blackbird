import { test } from "node:test";
import assert from "node:assert/strict";
import { replaceName, renamePlayerEverywhere } from "../lib/playerRename.js";
import { deleteAccount, isDeletedPlayerName } from "../lib/accountDeletion.js";

/**
 * A tiny in-memory stand-in for the Supabase service-role client: enough of
 * select/update/delete with eq, in, contains, range and maybeSingle.
 */
function fakeDb(tables, { authUsers = [] } = {}) {
  const db = structuredClone(tables);
  const users = new Set(authUsers);
  const calls = [];
  const matches = (row, filters) =>
    filters.every(([op, col, val]) => {
      if (op === "eq") return row[col] === val;
      if (op === "in") return val.includes(row[col]);
      if (op === "contains") return JSON.parse(val).every((v) => (row[col] || []).includes(v));
      return true;
    });
  function query(table, kind, payload) {
    const filters = [];
    let range = null;
    const q = {
      eq: (c, v) => (filters.push(["eq", c, v]), q),
      in: (c, v) => (filters.push(["in", c, v]), q),
      contains: (c, v) => (filters.push(["contains", c, v]), q),
      range: (a, b) => ((range = [a, b]), q),
      maybeSingle: async () => {
        const r = await run();
        return { data: r.data[0] || null, error: null };
      },
      then: (res, rej) => run().then(res, rej),
    };
    async function run() {
      const rows = db[table] || (db[table] = []);
      if (kind === "select") {
        let out = rows.filter((r) => matches(r, filters)).map((r) => structuredClone(r));
        if (range) out = out.slice(range[0], range[1] + 1);
        return { data: out, error: null };
      }
      if (kind === "update") {
        for (const r of rows) if (matches(r, filters)) Object.assign(r, structuredClone(payload));
        calls.push(["update", table, payload]);
        return { data: null, error: null };
      }
      if (kind === "delete") {
        db[table] = rows.filter((r) => !matches(r, filters));
        calls.push(["delete", table]);
        return { data: null, error: null };
      }
    }
    return q;
  }
  const admin = {
    from: (t) => ({ select: () => query(t, "select"), update: (p) => query(t, "update", p), delete: () => query(t, "delete") }),
    auth: {
      admin: {
        deleteUser: async (id) => {
          calls.push(["deleteUser", id]);
          if (!users.has(id)) return { error: { status: 404, message: "User not found" } };
          users.delete(id);
          return { error: null };
        },
      },
    },
  };
  return { admin, db: () => db, calls, users };
}

const seed = () => ({
  players: [
    { id: "p1", username: "Sam", auth_id: "u1", handle: "sam", bio: "Tuesday league", location: "Austin", tag: "SAM", tag_icon: "crown", cover: "night", color: "#123456", hidden: false, elo: 1210 },
    { id: "p2", username: "Alex", auth_id: "u2", handle: "alex", bio: null, location: null, tag: null, tag_icon: null, cover: null, color: null, hidden: false, elo: 1000 },
  ],
  game_results: [
    { id: "r1", game_id: "g1", username: "Sam", winner: "Sam", opponents: ["Alex"], stats: { visits: [{ darts: ["T20", "D16"] }] } },
    { id: "r2", game_id: "g1", username: "Alex", winner: "Sam", opponents: ["Sam"], stats: { eliminatedBy: "Sam", resetBy: [{ by: "Sam", turn: 3 }] } },
    { id: "r3", game_id: "g2", username: "Alex", winner: "Alex", opponents: ["bot:rook"], stats: {} },
  ],
  matches: [{ id: "m1", players: ["Sam", "Alex"], winner: "Sam", per_player: { Sam: { avg: 60 }, Alex: { avg: 55 } } }],
  follows: [
    { follower: "u2", followed: "p1" },
    { follower: "u1", followed: "p2" },
  ],
});

test("replaceName swaps exact strings and keys, and keeps untouched values by reference", () => {
  const v = { a: ["Sam", "Samuel"], Sam: { by: "Sam" }, n: 3 };
  assert.deepEqual(replaceName(v, "Sam", "Z"), { a: ["Z", "Samuel"], Z: { by: "Z" }, n: 3 });
  const same = { a: ["x"], b: { c: 1 } };
  assert.equal(replaceName(same, "Sam", "Z"), same);
});

test("renamePlayerEverywhere reaches results, opponents' stats and legacy matches", async () => {
  const f = fakeDb(seed());
  await renamePlayerEverywhere(f.admin, "Sam", "Samantha");
  const db = f.db();
  assert.equal(db.players[0].username, "Samantha");
  assert.deepEqual(db.game_results.find((r) => r.id === "r1").username, "Samantha");
  const r2 = db.game_results.find((r) => r.id === "r2");
  assert.equal(r2.winner, "Samantha");
  assert.deepEqual(r2.opponents, ["Samantha"]);
  assert.deepEqual(r2.stats, { eliminatedBy: "Samantha", resetBy: [{ by: "Samantha", turn: 3 }] });
  assert.deepEqual(db.matches[0].players, ["Samantha", "Alex"]);
  assert.equal(db.matches[0].winner, "Samantha");
  assert.deepEqual(Object.keys(db.matches[0].per_player), ["Samantha", "Alex"]);
  // an unrelated game is not rewritten
  assert.equal(f.calls.filter(([op, t]) => op === "update" && t === "game_results").length, 2);
});

test("a player named like a dart keeps dart logs intact", async () => {
  const t = seed();
  t.players[0].username = "D16";
  t.game_results[0].username = "D16";
  t.game_results[0].winner = "D16";
  const f = fakeDb(t);
  await renamePlayerEverywhere(f.admin, "D16", "Renamed");
  const r1 = f.db().game_results.find((r) => r.id === "r1");
  assert.equal(r1.username, "Renamed");
  assert.deepEqual(r1.stats.visits[0].darts, ["T20", "D16"]);
});

test("deleteAccount anonymizes the player, keeps games, and deletes the login last", async () => {
  const f = fakeDb(seed(), { authUsers: ["u1", "u2"] });
  const out = await deleteAccount(f.admin, "u1", { makeId: () => "abcdef12-3456" });
  const db = f.db();
  const p = db.players.find((x) => x.id === "p1");
  assert.equal(p.username, "Deleted player abcdef");
  assert.deepEqual(out.players, ["Deleted player abcdef"]);
  for (const k of ["handle", "bio", "location", "tag", "tag_icon", "cover", "color"]) assert.equal(p[k], null, k);
  assert.equal(p.hidden, true);
  assert.equal(p.auth_id, "u1", "keeps the dead auth id so the row can't be claimed");
  assert.equal(p.elo, 1210);
  // games stay, under the new name, in the opponent's history too
  assert.equal(db.game_results.length, 3);
  assert.deepEqual(db.game_results.find((r) => r.id === "r2").opponents, ["Deleted player abcdef"]);
  assert.ok(!JSON.stringify(db).includes('"Sam"'));
  // nobody follows the deleted player any more; the other account is untouched
  assert.deepEqual(db.follows, [{ follower: "u1", followed: "p2" }]);
  assert.equal(db.players.find((x) => x.id === "p2").handle, "alex");
  assert.deepEqual(f.calls.at(-1), ["deleteUser", "u1"]);
  assert.ok(!f.users.has("u1"));
});

test("deleteAccount picks another name when the first is taken, and is safe to re-run", async () => {
  const t = seed();
  t.players.push({ id: "p9", username: "Deleted player aaaaaa", auth_id: "gone" });
  const f = fakeDb(t, { authUsers: ["u1"] });
  const ids = ["aaaaaa00", "bbbbbb00"];
  await deleteAccount(f.admin, "u1", { makeId: () => ids.shift() });
  assert.equal(f.db().players.find((x) => x.id === "p1").username, "Deleted player bbbbbb");
  // second run: login already gone (404) and the player isn't renamed again
  const again = await deleteAccount(f.admin, "u1", { makeId: () => "cccccc00" });
  assert.deepEqual(again.players, ["Deleted player bbbbbb"]);
});

test("an account with no player still has its login deleted", async () => {
  const f = fakeDb(seed(), { authUsers: ["u3"] });
  const out = await deleteAccount(f.admin, "u3");
  assert.deepEqual(out.players, []);
  assert.ok(!f.users.has("u3"));
});

test("deleted-player names are recognised", () => {
  assert.equal(isDeletedPlayerName("Deleted player 1a2b3c"), true);
  assert.equal(isDeletedPlayerName("Sam"), false);
  assert.equal(isDeletedPlayerName(null), false);
});
