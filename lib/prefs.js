import { FONT_SCALES } from "./constants";

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
