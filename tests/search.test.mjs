import { test } from "node:test";
import assert from "node:assert/strict";
import { searchAll, myMatches } from "../lib/search.js";
import { GAME_MODES } from "../lib/summary.js";

const players = [
  { username: "Ann", handle: "annie", elo: 1040 },
  { username: "Gracie", handle: "gracie_d", elo: 1100 },
  { username: "Graham", handle: "gh", elo: 990 },
  { username: "Hidden", handle: "hid", elo: 1000, hidden: true },
];
const row = (gameId, username, extra) => ({ gameId, username, gameType: "x01", config: { startScore: 501, doubleOut: true }, opponents: [], result: "practice", completedAt: "2026-09-12T18:00:00Z", ...extra });
const results = [
  row("g1", "Ann", { opponents: ["Gracie"], result: "win", completedAt: "2026-09-12T18:00:00Z" }),
  row("g1", "Gracie", { opponents: ["Ann"], result: "loss", completedAt: "2026-09-12T18:00:00Z" }),
  row("g2", "Ann", { gameType: "cricket", config: { variant: "standard" }, opponents: ["bot:raven"], result: "practice", completedAt: "2026-08-03T18:00:00Z" }),
  row("g3", "Ann", { gameType: "bobs27", config: {}, completedAt: "2026-09-20T18:00:00Z" }),
  row("g4", "Gracie", { gameType: "cricket", opponents: ["Graham"], result: "win", completedAt: "2026-09-21T18:00:00Z" }),
];

test("players: name or @handle, no hidden players, not yourself, no bots", () => {
  const r = searchAll({ query: "gra", players, results, me: "Ann" });
  assert.deepEqual(r.players.map((p) => p.username), ["Gracie", "Graham"]);
  assert.deepEqual(searchAll({ query: "@annie", players, results, me: "Ann" }).players, []);
  assert.deepEqual(searchAll({ query: "hid", players, results, me: "Ann" }).players, []);
  assert.deepEqual(searchAll({ query: "raven", players, results, me: "Ann" }).players, [], "bots aren't players");
});

test("game modes: partial names, with how many you've played", () => {
  assert.deepEqual(searchAll({ query: "crick", players, results, me: "Ann" }).modes, [{ id: "cricket", name: "Cricket", games: 1 }]);
  assert.equal(searchAll({ query: "bob", players, results, me: "Ann" }).modes[0].id, "bobs27");
  assert.equal(searchAll({ query: "halve it", players, results, me: "Ann" }).modes[0].id, "halveit");
  assert.equal(searchAll({ query: "", players, results, me: "Ann" }).modes.length, GAME_MODES.length, "empty query lists every mode");
});

test("matches: only your games, one per game, newest first, by opponent, result or date", () => {
  assert.deepEqual(myMatches(results, "Ann").map((m) => m.gameId), ["g3", "g1", "g2"]);
  const byOpp = searchAll({ query: "gracie", players, results, me: "Ann" }).matches;
  assert.deepEqual(byOpp.map((m) => m.gameId), ["g1"]);
  assert.deepEqual(searchAll({ query: "raven", players, results, me: "Ann" }).matches.map((m) => m.gameId), ["g2"], "bots by name");
  assert.deepEqual(searchAll({ query: "won", players, results, me: "Ann" }).matches.map((m) => m.gameId), ["g1"]);
  assert.deepEqual(searchAll({ query: "sep 12", players, results, me: "Ann" }).matches.map((m) => m.gameId), ["g1"]);
  assert.deepEqual(searchAll({ query: "august", players, results, me: "Ann" }).matches.map((m) => m.gameId), ["g2"]);
  assert.deepEqual(searchAll({ query: "cricket graham", players, results, me: "Ann" }).matches, [], "Gracie's game with Graham isn't Ann's");
  assert.deepEqual(searchAll({ query: "gh", players, results, me: "Gracie" }).matches.map((m) => m.gameId), ["g4"], "opponents by @handle");
  assert.deepEqual(searchAll({ query: "", players, results, me: "Ann" }).matches.map((m) => m.gameId), ["g3", "g1", "g2"], "empty query: recent games");
});

test("achievements: by title, description or category; unlocked first; 'locked' narrows", () => {
  const achievements = [
    { id: "a", title: "Ton 80", description: "Score 180 in one visit.", category: "Scoring", unlocked: false, progress: { value: 1, target: 3 } },
    { id: "b", title: "Bot Slayer", description: "Beat a bot.", category: "Practice", unlocked: true, earnedAt: "2026-09-01" },
    { id: "c", title: "Ton Up", description: "Score 100 or more.", category: "Scoring", unlocked: true, earnedAt: "2026-09-10" },
  ];
  const r = searchAll({ query: "ton", achievements });
  assert.deepEqual(r.achievements.map((a) => a.id), ["c", "a"]);
  assert.deepEqual(searchAll({ query: "scoring locked", achievements }).achievements.map((a) => a.id), ["a"]);
  assert.deepEqual(searchAll({ query: "bot", achievements }).achievements.map((a) => a.id), ["b"]);
  assert.deepEqual(searchAll({ query: "", achievements }).achievements, [], "nothing listed until you type");
});

test("plans: by title or goal", () => {
  const plans = [
    { id: "p1", definition: { title: "Doubles Tune-Up", goal: "finishing" } },
    { id: "p2", definition: { title: "Cricket Month", goal: "cricket" } },
  ];
  assert.deepEqual(searchAll({ query: "doubles", plans }).plans.map((p) => p.id), ["p1"], "title, and the goal label Doubles & Finishing");
  assert.deepEqual(searchAll({ query: "finishing", plans }).plans.map((p) => p.id), ["p1"]);
  assert.deepEqual(searchAll({ query: "plan", plans }).plans.map((p) => p.id), ["p1", "p2"]);
});
