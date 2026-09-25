import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONS, hasIcon, iconParts } from "../lib/icons.js";
import { ACHIEVEMENTS } from "../lib/achievements.js";
import { TAG_ICONS } from "../lib/profile.js";

const EMOJI = /\p{Extended_Pictographic}/u;

test("every achievement has a vector icon and no emoji", () => {
  for (const a of ACHIEVEMENTS) {
    assert.ok(hasIcon(a.icon), `${a.id}: unknown icon ${a.icon}`);
    assert.ok(!EMOJI.test(a.icon + a.title + a.description), a.id);
  }
});

test("every tag icon id has a vector icon and no emoji glyph", () => {
  for (const t of TAG_ICONS) {
    assert.ok(hasIcon(t.id), t.id);
    assert.equal(t.glyph, undefined);
  }
});

test("icon paths are well formed", () => {
  for (const [id, parts] of Object.entries(ICONS)) {
    assert.ok(parts.length > 0, id);
    for (const p of iconParts(id)) {
      assert.match(p.d, /^M[-\d.]/, `${id} starts with a move`);
      assert.ok(!/NaN|undefined/.test(p.d), id);
    }
  }
});
