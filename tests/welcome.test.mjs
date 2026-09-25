import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting, welcomeInsights, pickInsight } from "../lib/welcome.js";

test("greeting follows the time of day, and says welcome back after a break", () => {
  assert.equal(greeting("Matthew Smith", new Date(2026, 8, 25, 9)), "Good morning, Matthew");
  assert.equal(greeting("Matthew", new Date(2026, 8, 25, 14)), "Good afternoon, Matthew");
  assert.equal(greeting("Matthew", new Date(2026, 8, 25, 21)), "Good evening, Matthew");
  assert.equal(greeting("Matthew", new Date(2026, 8, 25, 21), new Date(2026, 8, 20)), "Welcome back, Matthew");
});

const row = (id, user, winner, opp, date, elo) => ({ gameId: id, username: user, winner, result: winner === user ? "win" : "loss", opponents: [opp], completedAt: date, eloAfter: elo, gameType: "baseball" });
const results = [
  row("1", "Matthew", "Chuck", "Chuck", "2026-09-10T20:00:00Z", 990),
  row("2", "Matthew", "Chuck", "Chuck", "2026-09-20T20:00:00Z", 980),
  row("3", "Matthew", "Matthew", "Chuck", "2026-09-22T20:00:00Z", 998),
  row("4", "Chuck", "Chuck", "Lindsey", "2026-09-24T20:00:00Z", 1050),
];

test("insights come only from real data, with the rival and since-last-visit lines", () => {
  const stats = { Matthew: { games: 3, winStreak: 1, lastFive: ["L", "L", "W"] } };
  const badges = [{ id: "games_10", title: "Regular", unlocked: false, progress: { value: 3, target: 10 } }];
  const list = welcomeInsights({ me: "Matthew", stats, results, badges, following: ["Chuck"], lastVisit: "2026-09-23T00:00:00Z", now: new Date("2026-09-25T12:00:00Z") });
  const byKind = Object.fromEntries(list.map((i) => [i.kind, i]));
  assert.equal(byKind.form.text, "Last 3: L L W");
  assert.equal(byKind.rival.text, "Chuck leads you 2–1. Time for a rematch?");
  assert.equal(byKind.rival.opponent, "Chuck");
  assert.equal(byKind.badge.text, "7 to go for Regular (3/10)");
  assert.equal(byKind.since.text, "Chuck played 1 game since you were last here.");
  assert.deepEqual(welcomeInsights({ me: "Nobody", stats: {}, results: [], badges: [] }), []);
});

test("the pick never repeats the last kind when there is a choice", () => {
  const list = [{ kind: "form" }, { kind: "rival" }];
  for (let i = 0; i < 20; i++) assert.equal(pickInsight(list, "form", () => i / 20).kind, "rival");
  assert.equal(pickInsight([{ kind: "form" }], "form").kind, "form");
  assert.equal(pickInsight([], null), null);
});
