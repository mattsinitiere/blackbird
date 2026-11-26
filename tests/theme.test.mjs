import { test } from "node:test";
import assert from "node:assert/strict";
import { themePref, resolveTheme, applyThemePref } from "../lib/prefs.js";

test("theme: accounts that never chose one follow the device", () => {
  assert.equal(themePref(undefined), "system");
  assert.equal(themePref(null), "system");
  assert.equal(themePref("purple"), "system");
  assert.equal(resolveTheme(undefined, true), "dark");
  assert.equal(resolveTheme(undefined, false), "light");
});

test("theme: a saved Light or Dark choice is kept whatever the device says", () => {
  assert.equal(themePref("light"), "light");
  assert.equal(themePref("dark"), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("theme: System keeps following the device until another choice is made", () => {
  const listeners = new Set();
  const mq = {
    matches: false,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  const root = { dataset: {} };
  globalThis.document = { documentElement: root };
  globalThis.window = { matchMedia: () => mq };
  try {
    applyThemePref("system");
    assert.equal(root.dataset.theme, "light");
    mq.matches = true;
    listeners.forEach((fn) => fn());
    assert.equal(root.dataset.theme, "dark");

    applyThemePref("light");
    assert.equal(root.dataset.theme, "light");
    assert.equal(listeners.size, 0, "an explicit choice stops following the device");
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
