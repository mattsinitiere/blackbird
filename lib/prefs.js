import { FONT_SCALES } from "./constants.js";

export const THEME_KEY = "bb-theme";

/** A stored theme preference: "light", "dark" or "system" (the default). */
export function themePref(pref) {
  return pref === "light" || pref === "dark" ? pref : "system";
}

/** The theme to draw: "system" follows the device's light/dark setting. */
export function resolveTheme(pref, prefersDark = false) {
  const p = themePref(pref);
  return p === "system" ? (prefersDark ? "dark" : "light") : p;
}

/** Draw a theme preference now and cache it for the pre-paint script in app/layout.js. */
export function applyTheme(pref) {
  if (typeof document === "undefined") return;
  const dark = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  document.documentElement.dataset.theme = resolveTheme(pref, dark);
  try {
    window.localStorage.setItem(THEME_KEY, themePref(pref));
  } catch {}
}

// Resolve a stored text-size preference (an id like "large", or a raw number)
// to a clamped multiplier between 1x and 2x. Falls back to 1x (Normal).
export function fontScaleValue(pref) {
  const byId = FONT_SCALES.find((f) => f.id === pref);
  if (byId) return byId.value;
  const n = Number(pref);
  if (Number.isFinite(n)) return Math.min(2, Math.max(1, n));
  return 1;
}

// Apply the text-size preference to the document via two CSS variables:
//   --fs        scales content text (scores, names, keypad) the full amount
//   --fs-chrome scales shell text (nav, tags, table headers, brand) on a
//               gentler curve so the layout still fits at the largest size.
export function applyFontScale(pref) {
  if (typeof document === "undefined") return;
  const v = fontScaleValue(pref);
  const root = document.documentElement;
  root.style.setProperty("--fs", String(v));
  root.style.setProperty("--fs-chrome", String(1 + (v - 1) * 0.5));
}
