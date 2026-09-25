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

test("every bot has its own portrait", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../components/BotAvatar.js", import.meta.url), "utf8");
  const { BOTS } = await import("../lib/bots.js");
  for (const b of BOTS) assert.ok(src.includes(`"${b.id}": () =>`), `${b.id} has no portrait`);
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
