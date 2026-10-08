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

test("every bot has a ring color", async () => {
  const { BOTS, botColors } = await import("../lib/bots.js");
  const colors = botColors();
  for (const id of [...BOTS.map((b) => b.id), "bot:alterego"]) assert.match(colors[id] || "", /^#[0-9a-f]{6}$/i, `${id} has no color`);
});

test("no two bots share a look-alike color", async () => {
  const { botColors } = await import("../lib/bots.js");
  // CIE76 distance in Lab: under ~20 two rings read as the same color
  const lab = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047), y = f(r * 0.2126 + g * 0.7152 + b * 0.0722), z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const list = Object.entries(botColors());
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [lab(list[i][1]), lab(list[j][1])];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(d >= 20, `${list[i][0]} and ${list[j][0]} look alike (${d.toFixed(1)})`);
    }
  }
});

test("the migration's allowed tag icons and covers match the app's lists", async () => {
  const fs = await import("node:fs");
  const sql = fs.readFileSync(new URL("../supabase/migration-tag-icons-covers.sql", import.meta.url), "utf8");
  const { COVERS } = await import("../lib/covers.js");
  const list = (constraint) => {
    const m = sql.match(new RegExp(`${constraint}[\\s\\S]*?in \\(([\\s\\S]*?)\\)\\)`));
    return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  };
  assert.deepEqual(list("players_tag_icon_set"), TAG_ICONS.map((t) => t.id).sort());
  // covers were widened later by their own migration
  const coverSql = fs.readFileSync(new URL("../supabase/migration-contours-cover.sql", import.meta.url), "utf8");
  const covers = [...coverSql.match(/players_cover_set[\s\S]*?in \(([\s\S]*?)\)\)/)[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(covers, COVERS.map((c) => c.id).sort());
});
