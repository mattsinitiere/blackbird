import { test } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, computeAchievements, diffUnlocked, nextUp, readSeen, writeSeen, seenKey, progressText } from "../lib/achievements.js";
import { replayX01Visits } from "../lib/x01log.js";

const T = (n) => ({ n, mult: 3 });
const D = (n) => ({ n, mult: 2 });
const S = (n) => ({ n, mult: 1 });
let id = 0;
const at = (d) => `2026-09-${String(d).padStart(2, "0")}T20:00:00.000Z`;
function game(dayN, gameType, winner, opp, stats, config = {}, me = "Ann") {
  return { id: ++id, gameId: `g${id}`, username: me, gameType, config, winner, result: winner === me ? "win" : "loss", opponents: [opp], stats, eloAfter: 1000 + id * 20, completedAt: at(dayN) };
}
// a 180 leg finished on the bull: T20 T20 T20 (180) ... D25 last
const bullLeg = { dartsThrown: 6, pointsScored: 301, highestTurn: 180, checkout: 121, darts: [T(20), T(20), T(20), T(20), S(11), D(25)] };
const results = [
  game(1, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280, highestTurn: 60, checkout: 0, darts: [] }, { startScore: 301, doubleOut: true }),
  game(2, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280, highestTurn: 60, checkout: 0 }, { startScore: 301, doubleOut: true }),
  game(3, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280, highestTurn: 60, checkout: 0 }, { startScore: 301, doubleOut: true }),
  game(4, "x01", "Ann", "Bob", bullLeg, { startScore: 301, doubleOut: true }),           // comeback, first win, 180, bull finish, ton-plus finish
  game(5, "cricket", "Ann", "Bob", { marks: 20, rounds: 6, roundMarks: [4, 3, 3, 4, 3, 3], mpr: 3.33, pointsScored: 10 }),
  game(6, "baseball", "Ann", "Bob", { runs: 9, darts: [] }),                               // hat-trick, all-rounder
];
const practice = [
  { id: 900, gameId: "p1", username: "Ann", gameType: "bobs27", config: {}, winner: "Ann", result: "practice", opponents: [], stats: { finalScore: 90, doublesHit: 30, roundsCompleted: 21, busted: false, dartsThrown: 63, darts: [] }, eloAfter: 1000, completedAt: at(7) },
  { id: 901, gameId: "p2", username: "Ann", gameType: "x01", config: { startScore: 301 }, winner: "Ann", result: "practice", opponents: ["bot:rook"], stats: { dartsThrown: 20, pointsScored: 301, highestTurn: 100, checkout: 40 }, eloAfter: 1000, completedAt: at(8) },
];
const social = { following: [{ username: "Bob", createdAt: at(9) }], followers: [] };

test("every badge has the required shape", () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.id && a.title && a.description && a.icon && a.category, a.id);
    assert.equal(typeof a.test, "function", a.id);
  }
  assert.ok(ACHIEVEMENTS.length >= 30);
});

test("earned dates come from the game that earned the badge", () => {
  const b = Object.fromEntries(computeAchievements({ me: "Ann", results, practice, social }).map((x) => [x.id, x]));
  assert.equal(b.first_game.earnedAt, at(1));
  assert.equal(b.first_win.earnedAt, at(4));
  assert.equal(b.one_eighty.earnedAt, at(4));
  assert.equal(b.bull_finish.earnedAt, at(4));
  assert.equal(b.checkout_100.earnedAt, at(4));
  assert.equal(b.comeback.earnedAt, at(4));
  assert.equal(b.cricket_first_win.earnedAt, at(5));
  assert.equal(b.mpr_3.earnedAt, at(5));
  assert.equal(b.streak_3.earnedAt, at(6));
  assert.equal(b.all_rounder.earnedAt, at(6));
  assert.equal(b.first_drill.earnedAt, at(7));
  assert.equal(b.bobs27_clean.earnedAt, at(7));
  assert.equal(b.bot_slayer.earnedAt, at(8));
  assert.equal(b.first_follow.earnedAt, at(9));
  assert.equal(b.games_10.unlocked, false);
  assert.deepEqual(b.games_10.progress, { value: 6, target: 10, kind: "count" });
  assert.deepEqual(b.streak_7.progress, { value: 3, target: 7, kind: "streak", best: 3 });
  assert.equal(b.ton_up.earnedAt, at(4));
  assert.equal(b.checkout_170.unlocked, false);
  assert.equal(b.explorer.progress.value, 4); // x01, cricket, baseball, bobs27
});

test("a row without a dart log still earns the 180 badge from highestTurn", () => {
  const b = computeAchievements({ me: "Ann", results: [game(1, "x01", "Ann", "Bob", { dartsThrown: 9, pointsScored: 501, highestTurn: 180, checkout: 40 }, { startScore: 501, doubleOut: true })], practice: [] });
  assert.equal(b.find((x) => x.id === "one_eighty").unlocked, true);
  assert.equal(b.find((x) => x.id === "short_leg").unlocked, true);
});

test("selfOnly badges are omitted without social data", () => {
  const ids = computeAchievements({ me: "Ann", results, practice }).map((b) => b.id);
  assert.ok(!ids.includes("first_follow"));
  assert.ok(!ids.includes("crew_5"));
  assert.ok(ids.includes("rivalry_10"));
});

test("diffUnlocked returns exactly the badges the appended game earns", () => {
  const before = computeAchievements({ me: "Ann", results: results.slice(0, 5), practice: [] });
  const after = computeAchievements({ me: "Ann", results, practice: [] });
  assert.deepEqual(diffUnlocked(before, after).map((b) => b.id).sort(), ["all_rounder", "redemption", "streak_3", "weekend_warrior"]); // L L L then W W W, Sat + Sun
});

test("nextUp orders locked badges by progress", () => {
  const b = computeAchievements({ me: "Ann", results, practice, social });
  const ids = nextUp(b, 3).map((x) => x.id);
  assert.equal(ids[0], "high_five"); // a 4-mark round is 4/5
  assert.equal(ids[1], "explorer"); // 4/6 beats games_10 at 6/10
  assert.ok(ids.length === 3);
});

test("seen bookkeeping is safe without storage", () => {
  assert.deepEqual([...readSeen(null, "k")], []);
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  writeSeen(storage, seenKey("u1"), ["a", "b", "a"]);
  assert.deepEqual([...readSeen(storage, seenKey("u1"))], ["a", "b"]);
});

test("streak badges count the CURRENT run, not the best one", () => {
  // W W L L L: best run 2, current run 0
  const rows = [
    game(1, "x01", "Ann", "Bob", { dartsThrown: 30, pointsScored: 280 }),
    game(2, "x01", "Ann", "Bob", { dartsThrown: 30, pointsScored: 280 }),
    game(3, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280 }),
    game(4, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280 }),
    game(5, "x01", "Bob", "Bob", { dartsThrown: 30, pointsScored: 280 }),
  ];
  const b = Object.fromEntries(computeAchievements({ me: "Ann", results: rows, practice: [] }).map((x) => [x.id, x]));
  assert.equal(b.streak_3.unlocked, false);
  assert.deepEqual(b.streak_3.progress, { value: 0, target: 3, kind: "streak", best: 2 });
  assert.equal(progressText(b.streak_3.progress), "Current run 0 of 3 · best ever 2");
  // a broken streak is not "almost there"
  assert.ok(!nextUp(computeAchievements({ me: "Ann", results: rows, practice: [] })).some((x) => x.id === "streak_3"));
});

test("record badges read as best-so-far, counting badges as N to go", () => {
  assert.equal(progressText({ value: 45, target: 60, kind: "best" }), "Your best so far is 45. The target is 60.");
  assert.equal(progressText({ value: 6, target: 10, kind: "count" }), "6 / 10 · 4 to go");
  assert.equal(progressText({ value: 45, target: 60, kind: "best" }, { short: true }), "Best 45 / 60");
});

test("finishing badges count legs won in a lost best-of match", () => {
  // leg 1 won with a 170 finished on the bull, leg 2 lost, match lost
  // 180 (321 left), T20 T17 D20 = 151 (170 left), T20 T20 D-bull = 170 out in 9 darts
  const leg1 = [T(20), T(20), T(20), T(20), T(17), D(20), T(20), T(20), D(25)];
  const visits = replayX01Visits(leg1, 501, true, 0).map((v, i) => ({ ...v, i }));
  const row = game(10, "x01", "Bob", "Bob", { v: 2, dartsThrown: leg1.length, pointsScored: 501, darts: leg1, visits, legs: [{ w: "Ann", d: leg1.length, co: 170, s0: 501 }, { w: "Bob", d: 12, co: 0, s0: 501 }] }, { startScore: 501, doubleOut: true, legs: 3 });
  const b = Object.fromEntries(computeAchievements({ me: "Ann", results: [row], practice: [] }).map((x) => [x.id, x]));
  assert.equal(b.first_checkout.unlocked, true);
  assert.equal(b.checkout_170.unlocked, true);
  assert.equal(b.bull_finish.unlocked, true);
  assert.equal(b.short_leg.unlocked, true);
  assert.equal(b.first_win.unlocked, false);
});

test("new badges: login streaks, profile, fun and game modes", async () => {
  const { dayStreakBadge } = await import("../lib/achievements.js");
  const now = new Date(2026, 8, 25, 12);
  const days = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
  const s7 = dayStreakBadge(days, 7, now);
  assert.equal(s7.earnedAt, null);
  assert.deepEqual(s7.progress, { value: 4, target: 7, kind: "streak", best: 4 });
  assert.equal(dayStreakBadge(days, 3, now).earnedAt, "2026-09-20");
  // a gap of more than a day ends the current run
  assert.equal(dayStreakBadge(["2026-09-20", "2026-09-21"], 3, now).progress.value, 0);
  const soc = { following: [], followers: [], activity: { visitDays: days, profile: { color: "2026-09-01T00:00:00Z", bio: "2026-09-02T00:00:00Z" } } };
  const b = Object.fromEntries(computeAchievements({ me: "Ann", results, practice, social: soc, now }).map((x) => [x.id, x]));
  assert.equal(b.days_3.unlocked, true);
  assert.equal(b.fresh_paint.unlocked, true);
  assert.equal(b.cover_story.unlocked, false);
  assert.deepEqual(b.fully_loaded.progress, { value: 2, target: 6, kind: "count" });
  assert.equal(b.warm_up.earnedAt, at(1));
  assert.equal(b.high_five.unlocked, false); // best cricket round was 4 marks
  assert.equal(b.high_five.progress.value, 4);
  // without the player's own activity the self-only badges are hidden
  const other = computeAchievements({ me: "Ann", results, practice }).map((x) => x.id);
  assert.ok(!other.includes("days_7") && !other.includes("fresh_paint"));
  // Elo progress counts from the 1000 start, so it doesn't top "next up"
  assert.equal(b.elo_1200.progress.base, 1000);
});

test("Addict: 50 games of any kind in one day", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ ...game(3, "x01", "Ann", "Bob", { dartsThrown: 30, pointsScored: 280 }), completedAt: `2026-09-03T${String(10 + Math.floor(i / 6)).padStart(2, "0")}:${String((i % 6) * 5).padStart(2, "0")}:00.000Z` }));
  const prac = Array.from({ length: 20 }, (_, i) => ({ id: 2000 + i, gameId: `pp${i}`, username: "Ann", gameType: "checkoutDrill", config: {}, winner: "Ann", result: "practice", opponents: [], stats: {}, eloAfter: 1000, completedAt: `2026-09-03T16:${String(i).padStart(2, "0")}:00.000Z` }));
  const b = computeAchievements({ me: "Ann", results: rows, practice: prac }).find((x) => x.id === "addict");
  assert.equal(b.unlocked, true);
  const half = computeAchievements({ me: "Ann", results: rows, practice: [] }).find((x) => x.id === "addict");
  assert.deepEqual(half.progress, { value: 30, target: 50, kind: "best" });
});
