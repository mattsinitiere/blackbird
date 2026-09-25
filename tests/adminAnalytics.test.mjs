import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalytics, rangeFor } from "../lib/adminAnalytics.js";

const now = new Date("2026-09-25T18:00:00Z");
const base = {
  users: [
    { id: "u1", createdAt: "2026-06-01T10:00:00Z" },
    { id: "u2", createdAt: "2026-09-20T10:00:00Z" },
    { id: "u3", createdAt: "2026-09-24T03:00:00Z" }, // Sep 23 in Chicago
  ],
  players: [{ username: "Ann", authId: "u1" }, { username: "Bob", authId: "u2" }],
  events: [{ auth_id: "u1", kind: "visit", day: "2026-09-24" }, { auth_id: "u3", kind: "visit", day: "2026-09-24" }],
  games: [
    // one ranked game = two result rows
    { game_id: "g1", username: "Ann", game_type: "x01", result: "win", opponents: ["Bob"], completed_at: "2026-09-22T20:00:00Z" },
    { game_id: "g1", username: "Bob", game_type: "x01", result: "loss", opponents: ["Ann"], completed_at: "2026-09-22T20:00:00Z" },
    { game_id: "g2", username: "Ann", game_type: "x01", result: "practice", opponents: ["bot:alterego"], completed_at: "2026-09-23T20:00:00Z" },
    { game_id: "g0", username: "Ann", game_type: "cricket", result: "win", opponents: ["Bob"], completed_at: "2026-01-02T20:00:00Z" },
  ],
  aiLog: [
    { auth_id: "u1", kind: "chat", model: "openai/gpt-6-luna", effort: "none", input_tokens: 1000000, output_tokens: 200000, duration_ms: 4000, status: "ok", created_at: "2026-09-24T10:00:00Z" },
    { auth_id: "u1", kind: "plan", model: "openai/gpt-6-luna", effort: "none", input_tokens: null, output_tokens: null, duration_ms: 2000, status: "error", fallback: "no-stream", created_at: "2026-09-24T11:00:00Z" },
    { auth_id: "u2", kind: "chat", model: "openai/gpt-6-luna", effort: "none", input_tokens: 10, output_tokens: 10, duration_ms: 1000, status: "ok", created_at: "2025-01-01T10:00:00Z" },
  ],
  aiUsage: [{ auth_id: "u1", day: "2026-09-24", count: 2 }],
  plans: [{ auth_id: "u1", source: "ai", created_at: "2026-09-21T10:00:00Z" }, { auth_id: "u1", source: "custom", created_at: "2026-09-22T10:00:00Z" }],
  completions: [{ completed_at: "2026-09-23T10:00:00Z" }],
};

test("games count distinct game ids, not result rows; ranked vs practice split", () => {
  const a = buildAnalytics({ ...base, prices: {} }, "30d", now);
  assert.equal(a.games.games, 2);
  assert.equal(a.games.ranked, 1);
  assert.equal(a.games.practice, 1);
  assert.deepEqual(a.games.byMode, { x01: 2 });
  assert.equal(a.games.series.reduce((s, p) => s + p.y, 0), 2);
  assert.equal(buildAnalytics({ ...base, prices: {} }, "all", now).games.games, 3);
});

test("sign-ups in the period and a full daily series with empty days", () => {
  const a = buildAnalytics({ ...base, prices: {} }, "7d", now);
  assert.equal(a.signups.total, 3);
  assert.equal(a.signups.inRange, 2);
  assert.equal(a.signups.linked, 2);
  assert.ok(a.signups.series.length >= 7);
  const sep23 = a.signups.series.find((p) => p.label === "2026-09-23");
  assert.equal(sep23.y, 1, "a late-night UTC sign-up lands on its Chicago day");
});

test("active users combine visits and players; AI totals, health and top users", () => {
  const a = buildAnalytics({ ...base, prices: {} }, "30d", now);
  assert.equal(a.active.users, 3); // u1 + u3 visited, u2 (Bob) played
  assert.equal(a.active.played, 2);
  assert.equal(a.ai.requests, 2, "the 2025 row is outside the period");
  assert.equal(a.ai.errors, 1);
  assert.equal(a.ai.fallbacks, 1);
  assert.equal(a.ai.tokensIn, 1000000);
  assert.equal(a.ai.tokensCoverage, 0.5);
  assert.deepEqual(a.ai.topUsers, [{ name: "Ann", requests: 2 }]);
  assert.equal(a.ai.cost, null, "no prices, no made-up cost");
  assert.equal(a.training.plans, 2);
  assert.equal(a.training.completions, 1);
  assert.equal(a.training.alterEgoGames, 1);
});

test("cost is estimated only from configured prices", () => {
  const a = buildAnalytics({ ...base, prices: { input: 1.5, output: 6 } }, "30d", now);
  assert.equal(a.ai.cost.input, 1.5);
  assert.equal(Math.round(a.ai.cost.output * 100) / 100, 1.2);
  assert.equal(Math.round(a.ai.cost.total * 100) / 100, 2.7);
});

test("missing tables report null rather than zero", () => {
  const a = buildAnalytics({ ...base, aiLog: null, plans: null, prices: {} }, "30d", now);
  assert.equal(a.ai, null);
  assert.equal(a.allowance.requests, 2);
  assert.equal(a.training.plans, null);
  assert.equal(rangeFor("nope").id, "30d");
});
