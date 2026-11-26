import { test } from "node:test";
import assert from "node:assert/strict";
import { saveHealth } from "../lib/adminAnalytics.js";

const now = new Date("2026-11-26T03:00:00Z");
const visit = (day) => ({ kind: "visit", day, auth_id: "a" });

test("warns when members keep opening the app but no game has been saved for days", () => {
  const h = saveHealth({ games: [{ completed_at: "2026-10-25T03:13:27Z" }], events: [visit("2026-10-27"), visit("2026-11-06"), visit("2026-11-25"), visit("2026-10-20")] }, now);
  assert.equal(h.warn, true);
  assert.equal(h.daysSince, 31);
  assert.equal(h.visitDaysSince, 3, "visits before the newest game don't count");
});

test("no warning when games are being saved, or when nobody is around", () => {
  assert.equal(saveHealth({ games: [{ completed_at: "2026-11-25T20:00:00Z" }], events: [visit("2026-11-25")] }, now).warn, false);
  assert.equal(saveHealth({ games: [{ completed_at: "2026-11-01T20:00:00Z" }], events: [] }, now).warn, false);
  assert.equal(saveHealth({ games: [{ completed_at: "2026-11-01T20:00:00Z" }], events: [visit("2026-11-10"), visit("2026-11-11")] }, now).warn, false);
});

test("no saved games at all in the period, with visits, also warns", () => {
  const h = saveHealth({ games: [], events: [visit("2026-11-20"), visit("2026-11-21"), visit("2026-11-22")] }, now);
  assert.equal(h.warn, true);
  assert.equal(h.lastGameAt, null);
});
