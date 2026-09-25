/**
 * Real dartboard geometry in millimeters, centered on the bull. Screen
 * convention: x to the right, y down, angles clockwise from 12 o'clock.
 * Shared by the SVG board (scaled) and the throw simulator (as is).
 * Pure: no React.
 */

/** Segment numbers clockwise from the top. */
export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Ring radii (mm) per the standard specification. */
export const RINGS = {
  bullInner: 6.35,
  bullOuter: 15.9,
  tripleInner: 99,
  tripleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
};

const SEG_DEG = 18;

/** Clockwise angle from 12 o'clock, in [0, 360). */
export function angleOf(x, y) {
  const a = (Math.atan2(x, -y) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** Point at radius r (mm) and clockwise angle deg from 12 o'clock. */
export function polar(r, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

/** The segment a point lands in: { n, mult }. n 0 = off the board. */
export function segmentAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= RINGS.bullInner) return { n: 25, mult: 2 };
  if (r <= RINGS.bullOuter) return { n: 25, mult: 1 };
  if (r > RINGS.doubleOuter) return { n: 0, mult: 0 };
  const idx = Math.round(angleOf(x, y) / SEG_DEG) % 20;
  const n = ORDER[idx];
  if (r >= RINGS.tripleInner && r <= RINGS.tripleOuter) return { n, mult: 3 };
  if (r >= RINGS.doubleInner) return { n, mult: 2 };
  return { n, mult: 1 };
}

/** Center of a bed, the natural aiming point for { n, mult }. */
export function aimPoint(n, mult) {
  if (n === 25) return mult === 2 ? { x: 0, y: 0 } : polar((RINGS.bullInner + RINGS.bullOuter) / 2, 0);
  const idx = ORDER.indexOf(n);
  const deg = (idx < 0 ? 0 : idx) * SEG_DEG;
  const r =
    mult === 3
      ? (RINGS.tripleInner + RINGS.tripleOuter) / 2
      : mult === 2
        ? (RINGS.doubleInner + RINGS.doubleOuter) / 2
        : (RINGS.tripleOuter + RINGS.doubleInner) / 2; // the big outer single
  return polar(r, deg);
}
