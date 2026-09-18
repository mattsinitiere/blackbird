import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHandle, validateHandle, suggestHandle, formatHandle } from "../lib/profile.js";

test("normalizeHandle strips @, case and punctuation", () => {
  assert.equal(normalizeHandle("@Matt S."), "matts");
  assert.equal(normalizeHandle("  Gracie ❤️ "), "gracie");
  assert.equal(normalizeHandle("chuck_cates"), "chuck_cates");
  assert.equal(normalizeHandle("a".repeat(30)).length, 20);
});

test("validateHandle enforces the DB rules and reserved names", () => {
  assert.equal(validateHandle("matt").ok, true);
  assert.equal(validateHandle("ab").ok, false);
  assert.equal(validateHandle("Matt").ok, false);
  assert.equal(validateHandle("___").ok, false);
  assert.equal(validateHandle("admin").ok, false);
  assert.equal(validateHandle("a".repeat(21)).ok, false);
});

test("suggestHandle always yields a valid handle", () => {
  for (const name of ["Matthew", "Al", "❤️", "admin", "Chuck Cates", "x".repeat(40)]) {
    const h = suggestHandle(name);
    assert.equal(validateHandle(h).ok, true, `${name} -> ${h}`);
  }
  assert.equal(suggestHandle("Matthew"), "matthew");
  assert.equal(suggestHandle("Al"), "al0");
});

test("formatHandle", () => {
  assert.equal(formatHandle("matt"), "@matt");
  assert.equal(formatHandle(null), "");
});
