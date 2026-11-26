import { test } from "node:test";
import assert from "node:assert/strict";
import { periodBounds, filterByPeriod, inPeriod, periodLabel, toInputDate, DEFAULT_PERIOD, openingPeriod, lastPlayed } from "../lib/period.js";

const now = new Date(2026, 8, 25, 12, 0, 0);
const rows = [
  { id: 1, completedAt: new Date(2026, 8, 24).toISOString() },
  { id: 2, completedAt: new Date(2026, 7, 10).toISOString() },
  { id: 3, completedAt: new Date(2026, 2, 1).toISOString() },
];

test("default is 30 days", () => assert.equal(DEFAULT_PERIOD, "30d"));

test("rolling windows", () => {
  assert.deepEqual(filterByPeriod(rows, periodBounds("30d", now)).map((r) => r.id), [1]);
  assert.deepEqual(filterByPeriod(rows, periodBounds("90d", now)).map((r) => r.id), [1, 2]);
  assert.deepEqual(filterByPeriod(rows, periodBounds("all", now)).map((r) => r.id), [1, 2, 3]);
});

test("custom range is inclusive, open-ended, and order-tolerant", () => {
  const b = periodBounds("custom", now, { from: "2026-08-10", to: "2026-08-10" });
  assert.deepEqual(filterByPeriod(rows, b).map((r) => r.id), [2]);
  assert.deepEqual(filterByPeriod(rows, periodBounds("custom", now, { from: "2026-08-01" })).map((r) => r.id), [1, 2]);
  assert.deepEqual(filterByPeriod(rows, periodBounds("custom", now, { from: "2026-09-30", to: "2026-08-01" })).map((r) => r.id), [1, 2]);
  assert.equal(inPeriod("garbage", b), false);
  assert.equal(periodLabel("custom", periodBounds("custom", now, {})), "Custom range: pick dates");
  assert.equal(periodLabel("30d", {}), "Last 30 days");
});

test("toInputDate", () => assert.equal(toInputDate(new Date(2026, 0, 5)), "2026-01-05"));

test("opens on the shortest range that holds a game", () => {
  assert.equal(openingPeriod(rows, now), "30d");
  assert.equal(openingPeriod(rows.slice(1), now), "90d");
  assert.equal(openingPeriod(rows.slice(2), now), "all");
  // nothing played: the usual default, the page is empty either way
  assert.equal(openingPeriod([], now), DEFAULT_PERIOD);
  assert.equal(openingPeriod(null, now), DEFAULT_PERIOD);
});

test("lastPlayed is the newest valid date", () => {
  assert.equal(lastPlayed([rows[2], rows[0], { completedAt: "garbage" }]).getTime(), new Date(rows[0].completedAt).getTime());
  assert.equal(lastPlayed([]), null);
  assert.equal(lastPlayed([{ completedAt: null }]), null);
});
