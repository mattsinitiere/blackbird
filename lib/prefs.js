import { FONT_SCALES } from "./constants.js";

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

// ---- theme ----
// The stored theme preference is "light", "dark" or "system" (follow the
// device's dark-mode setting). Accounts that never picked one follow the
// device; an explicit Light or Dark choice saved earlier is kept.
export const THEME_PREFS = ["system", "light", "dark"];

export function themePref(stored) {
  return THEME_PREFS.includes(stored) ? stored : "system";
}

/** The theme to render for a preference, given the device's dark mode. */
export function resolveTheme(pref, prefersDark) {
  const p = themePref(pref);
  if (p === "system") return prefersDark ? "dark" : "light";
  return p;
}

let stopFollowing = null;

/**
 * Apply a theme preference to the document. "system" keeps following the
 * device (a phone switching to dark mode at sunset switches the app too);
 * any other choice, or a page that forces its own theme, stops that.
 */
export function applyThemePref(pref) {
  if (typeof document === "undefined") return;
  if (stopFollowing) {
    stopFollowing();
    stopFollowing = null;
  }
  const p = themePref(pref);
  const mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const set = () => {
    document.documentElement.dataset.theme = resolveTheme(p, !!(mq && mq.matches));
  };
  set();
  if (p === "system" && mq) {
    if (mq.addEventListener) {
      mq.addEventListener("change", set);
      stopFollowing = () => mq.removeEventListener("change", set);
    } else if (mq.addListener) {
      mq.addListener(set);
      stopFollowing = () => mq.removeListener(set);
    }
  }
}
