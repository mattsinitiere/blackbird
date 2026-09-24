import { test } from "node:test";
import assert from "node:assert/strict";
import { followingUsernames, followerUsernames, circlePlayers, searchPlayers, followsForSocial } from "../lib/follows.js";
import { resultFromRow } from "../lib/practice.js";

const players = [
  { id: "p1", username: "Ann", authId: "a1", handle: "ann" },
  { id: "p2", username: "Bob", authId: "a2", handle: "bobby" },
  { id: "p3", username: "Guest Cy", authId: null, handle: null },
  { id: "p4", username: "bot:rook", authId: null, handle: null },
];
const follows = [
  { follower: "a1", followed: "p2", createdAt: "2026-09-01T00:00:00Z" },
  { follower: "a1", followed: "p3", createdAt: "2026-09-02T00:00:00Z" },
  { follower: "a2", followed: "p1", createdAt: "2026-09-03T00:00:00Z" },
];

test("following and followers resolve through player ids and auth ids", () => {
  assert.deepEqual([...followingUsernames(follows, players, "a1")], ["Bob", "Guest Cy"]);
  assert.deepEqual([...followerUsernames(follows, players, "p1")], ["Bob"]);
  assert.deepEqual([...followingUsernames(null, players, "a1")], []);
  assert.deepEqual([...followerUsernames(follows, players, null)], []);
});

test("circlePlayers: me first, then who I follow; null follows means everyone", () => {
  const following = followingUsernames(follows, players, "a2");
  assert.deepEqual(circlePlayers(players, following, "Bob").map((p) => p.username), ["Bob", "Ann"]);
  assert.equal(circlePlayers(players, null, "Bob").length, 4);
  assert.deepEqual(circlePlayers(players, new Set(), "Ann").map((p) => p.username), ["Ann"]);
});

test("searchPlayers: handle exact, name prefix, substring; bots and excluded left out", () => {
  assert.deepEqual(searchPlayers(players, "@bobby").map((p) => p.username), ["Bob"]);
  assert.deepEqual(searchPlayers(players, "b").map((p) => p.username), ["Bob"]);
  assert.deepEqual(searchPlayers(players, "cy").map((p) => p.username), ["Guest Cy"]);
  assert.deepEqual(searchPlayers(players, "ann", { exclude: ["Ann"] }), []);
  assert.deepEqual(searchPlayers(players, ""), []);
  assert.deepEqual(searchPlayers(players, "rook"), []);
});

test("followsForSocial: dated lists in order", () => {
  const s = followsForSocial(follows, players, { myAuthId: "a1", myPlayerId: "p1" });
  assert.deepEqual(s.following.map((f) => f.username), ["Bob", "Guest Cy"]);
  assert.deepEqual(s.followers.map((f) => f.username), ["Bob"]);
  assert.equal(s.followers[0].createdAt, "2026-09-03T00:00:00Z");
});

test("resultFromRow maps a database row to the in-memory shape", () => {
  const r = resultFromRow({ id: "r1", game_id: "g1", username: "Ann", game_type: "x01", config: null, winner: "Ann", result: "win", opponents: null, stats: null, elo_after: "1012", completed_at: "2026-09-24T00:00:00Z" });
  assert.deepEqual(r, { id: "r1", gameId: "g1", username: "Ann", gameType: "x01", config: {}, winner: "Ann", result: "win", opponents: [], stats: {}, eloAfter: 1012, completedAt: "2026-09-24T00:00:00Z" });
  assert.equal(resultFromRow({ game_id: "g", username: "A", game_type: "x01", winner: "A", result: "win" }).eloAfter, 1000);
});
