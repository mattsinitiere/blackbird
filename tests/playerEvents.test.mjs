import { test } from "node:test";
import assert from "node:assert/strict";
import { activityFromEvents, customisedParts, profileEventsToRecord } from "../lib/playerEvents.js";

test("events become visit days and first-customized dates", () => {
  const a = activityFromEvents([
    { kind: "visit", detail: "", day: "2026-09-02" },
    { kind: "visit", detail: "", day: "2026-09-01" },
    { kind: "visit", detail: "", day: "2026-09-01" },
    { kind: "profile", detail: "color", day: "2026-09-03", created_at: "2026-09-03T10:00:00Z" },
    { kind: "profile", detail: "color", day: "2026-09-05", created_at: "2026-09-05T10:00:00Z" },
  ]);
  assert.deepEqual(a.visitDays, ["2026-09-01", "2026-09-02"]);
  assert.equal(a.profile.color, "2026-09-03T10:00:00Z");
});

test("only set, unlogged profile parts get recorded", () => {
  const p = { color: "#fff", cover: null, bio: " ", location: "Waller, TX", tag: "DEV", handle: "matthew" };
  assert.deepEqual(customisedParts(p), ["color", "location", "tag", "handle"]);
  assert.deepEqual(profileEventsToRecord(p, { profile: { color: "x", tag: "y" } }), ["location", "handle"]);
  assert.deepEqual(customisedParts(null), []);
});
