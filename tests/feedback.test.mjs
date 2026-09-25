import { test } from "node:test";
import assert from "node:assert/strict";
import { setFeedbackPrefs, getFeedbackPrefs, kindForCelebration, HAPTICS, TONES, feedback } from "../lib/feedback.js";

test("feedback prefs default to haptics on, sounds off, and merge updates", () => {
  assert.deepEqual(getFeedbackPrefs(), { haptics: true, sounds: false });
  setFeedbackPrefs({ sounds: true });
  assert.deepEqual(getFeedbackPrefs(), { haptics: true, sounds: true });
  setFeedbackPrefs({ haptics: false, sounds: false });
  assert.deepEqual(getFeedbackPrefs(), { haptics: false, sounds: false });
});

test("celebrations map to the right feedback, and every kind has a pattern and tone", () => {
  assert.equal(kindForCelebration("180"), "big");
  assert.equal(kindForCelebration("win"), "big");
  assert.equal(kindForCelebration("halved"), "bust");
  assert.equal(kindForCelebration("nothing"), null);
  for (const k of ["dart", "bust", "big"]) {
    assert.ok(HAPTICS[k]);
    assert.ok(TONES[k].length);
  }
});

test("feedback is a no-op outside the browser", () => {
  assert.doesNotThrow(() => feedback("dart"));
});
