import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFeed, achievementFeed, mergeFeed, circleFor } from "../lib/activity.js";
import { profileHref, resolveProfileParam } from "../lib/profileLink.js";

const r = (id, user, gameType, winner, opponents, date, extra = {}) => ({
  gameId: id,
  username: user,
  gameType,
  config: extra.config || {},
  winner,
  result: extra.result || (winner === user ? "win" : "loss"),
  opponents,
  stats: extra.stats || {},
  eloAfter: extra.eloAfter ?? 1000,
  completedAt: date,
});

const results = [
  r("g1", "Ann", "x01", "Ann", ["Bob"], "2026-09-01T20:00:00Z", { eloAfter: 1016, config: { startScore: 501, doubleOut: true }, stats: { dartsThrown: 30, pointsScored: 501, highestTurn: 140, checkout: 121 } }),
  r("g2", "Ann", "killer", "Cat", ["Bob", "Cat", "Dan", "Eve"], "2026-09-02T20:00:00Z", { eloAfter: 1004, stats: { livesRemaining: 0, place: 3 } }),
  r("g3", "Ann", "cricket", "Bob", ["Bob"], "2026-09-03T20:00:00Z", { eloAfter: 990, stats: { pointsScored: 40, marks: 18, rounds: 10 } }),
  r("p1", "Ann", "x01", "Ann", ["bot:rookie"], "2026-09-04T20:00:00Z", { result: "practice" }),
  r("g1", "Bob", "x01", "Ann", ["Ann"], "2026-09-01T20:00:00Z"),
];

test("matchFeed: ranked only, newest first, mode-aware figures", () => {
  const feed = matchFeed(results, "Ann");
  assert.deepEqual(feed.map((f) => f.row.gameId), ["g3", "g2", "g1"]);
  const [cricket, killer, x01] = feed;
  assert.equal(x01.title, "501 · double out");
  assert.equal(x01.won, true);
  assert.equal(x01.primary.label, "3-dart avg");
  assert.equal(x01.primary.value, "50.1");
  assert.equal(x01.eloDelta, 16);
  assert.ok(x01.highlights.some((h) => h.label === "Ton-plus finish" && h.value === 121));
  assert.equal(killer.players, 5);
  assert.equal(killer.won, false);
  assert.equal(killer.winner, "Cat");
  assert.equal(killer.place, 3);
  assert.equal(killer.primary.label, "lives");
  assert.equal(killer.eloDelta, -12);
  assert.equal(cricket.primary.label, "points");
  assert.equal(cricket.place, null, "a loss without a stored place stays unknown");
});

test("achievements join the feed only when unlocked with a date", () => {
  const badges = [
    { id: "a", unlocked: true, earnedAt: "2026-09-01T20:00:00Z", title: "First" },
    { id: "b", unlocked: false, earnedAt: null },
    { id: "c", unlocked: true, earnedAt: null },
  ];
  const a = achievementFeed(badges);
  assert.deepEqual(a.map((x) => x.badge.id), ["a"]);
  const merged = mergeFeed(matchFeed(results, "Ann"), a);
  assert.equal(merged[merged.length - 2].kind, "match");
  assert.equal(merged[merged.length - 1].kind, "achievement");
});

test("circleFor: my follows with our record; someone else's frequent opponents", () => {
  const mine = circleFor({ user: "Ann", isMe: true, results, following: [{ username: "Bob" }, { username: "Zed" }] });
  assert.deepEqual(mine.map((c) => [c.username, c.games, c.wins, c.losses]), [["Bob", 3, 1, 1], ["Zed", 0, 0, 0]]);
  assert.equal(mine[0].otherWinner, 1);
  const theirs = circleFor({ user: "Ann", isMe: false, results });
  assert.equal(theirs[0].username, "Bob");
  assert.ok(!theirs.some((c) => c.username.startsWith("bot:")));
});

test("profile links resolve by @handle, then name", () => {
  const players = [{ username: "Chuck", handle: "chuck" }, { username: "Mary Jo", handle: null }];
  assert.equal(profileHref(players[0]), "/app?player=chuck");
  assert.equal(profileHref(players[1]), "/app?player=Mary%20Jo");
  assert.equal(resolveProfileParam("@Chuck", players), "Chuck");
  assert.equal(resolveProfileParam("mary jo", players), "Mary Jo");
  assert.equal(resolveProfileParam("nobody", players), null);
  assert.equal(resolveProfileParam("", players), null);
});

test("matchFeed hides figures older rows never logged", () => {
  const rows = [r("b1", "Ann", "baseball", "Ann", ["Bob"], "2026-06-13T20:00:00Z", { stats: { runs: 12 } }), r("x1", "Ann", "x01", "Ann", ["Bob"], "2026-06-14T20:00:00Z", { config: { startScore: 501, legs: 3 }, stats: { dartsThrown: 45, pointsScored: 501 } })];
  const [x01, baseball] = matchFeed(rows, "Ann");
  assert.equal(baseball.primary.value, 12);
  assert.ok(!baseball.figures.some((f) => f.label === "darts"));
  assert.equal(x01.primary, null, "no legs count was stored");
  assert.ok(x01.figures.some((f) => f.label === "3-dart avg"));
});
