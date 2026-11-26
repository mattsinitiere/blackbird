import { test } from "node:test";
import assert from "node:assert/strict";
import { openingRange } from "../lib/statsRange.js";

const now = new Date("2026-11-26T12:00:00Z");
const daysAgo = (n) => ({ completedAt: new Date(now - n * 86400000).toISOString() });

test("the first profile opens on the smart default", () => {
  assert.deepEqual(openingRange(null, [daysAgo(10)], now), { period: "30d", custom: { from: "", to: "" }, remembered: false });
  assert.equal(openingRange(null, [daysAgo(60)], now).period, "90d");
  assert.equal(openingRange(null, [daysAgo(200)], now).period, "all");
});

test("a range picked on an earlier profile carries over when this player has games in it", () => {
  // the smart default would be 30 days, but All Time was picked
  const r = openingRange({ period: "all", custom: { from: "", to: "" } }, [daysAgo(10)], now);
  assert.equal(r.period, "all");
  assert.equal(r.remembered, true);
  // 90 days picked, the player last played 60 days ago
  assert.equal(openingRange({ period: "90d" }, [daysAgo(60)], now).period, "90d");
});

test("a picked range that's empty for this player falls back to the smart default", () => {
  const r = openingRange({ period: "30d", custom: { from: "", to: "" } }, [daysAgo(60)], now);
  assert.equal(r.period, "90d");
  assert.equal(r.remembered, false);
  assert.equal(openingRange({ period: "90d" }, [daysAgo(200)], now).period, "all");
});

test("a custom range carries its dates, and falls back when it holds none of this player's games", () => {
  const picked = { period: "custom", custom: { from: "2026-11-01", to: "2026-11-20" } };
  const r = openingRange(picked, [daysAgo(10)], now);
  assert.deepEqual(r, { period: "custom", custom: { from: "2026-11-01", to: "2026-11-20" }, remembered: true });
  const empty = openingRange(picked, [daysAgo(60)], now);
  assert.deepEqual(empty, { period: "90d", custom: { from: "", to: "" }, remembered: false });
});

test("a player with no ranked games opens on the usual 30 days", () => {
  assert.equal(openingRange({ period: "all" }, [], now).period, "30d");
  assert.equal(openingRange(null, null, now).period, "30d");
});
