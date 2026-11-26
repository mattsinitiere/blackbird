/**
 * Y axis ticks for the SVG charts (components/Charts.js). The axis runs
 * from the first tick to the last, and every gridline is drawn at exactly
 * the value its label shows: steps of 1, 2, 2.5 or 5 times a power of
 * ten, so labels never need rounding (a "3" gridline is at 3, not 3.45).
 * Pure: no React.
 */

const NICE = [1, 2, 2.5, 5, 10];
const NICE_INT = [1, 2, 5, 10];

/** The nice step nearest above `raw`; `integer` keeps it a whole number. */
export function niceStep(raw, integer = false) {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  const list = integer && exp <= 0 ? NICE_INT : NICE;
  const f = raw / base;
  const m = list.find((x) => f <= x + 1e-9) || 10;
  const step = m * base;
  return integer ? Math.max(1, Math.round(step)) : step;
}

/** Decimal places that show a value on this step exactly. */
function placesOf(step) {
  for (let p = 0; p < 10; p++) if (Math.abs(Math.round(step * Math.pow(10, p)) - step * Math.pow(10, p)) < 1e-6) return p;
  return 10;
}

/**
 * Ticks covering [lo, hi] in about `count` steps: { min, max, step, ticks,
 * decimals }, ticks from min up to max. `integer` keeps every tick a whole
 * number (counts, lives, darts); `floor` / `ceil` cap the axis (0 and 100
 * for a percentage) when the data stays inside them.
 */
export function niceTicks(lo, hi, { count = 4, integer = false, floor = null, ceil = null } = {}) {
  let a = Number.isFinite(lo) ? lo : 0;
  let b = Number.isFinite(hi) ? hi : a;
  if (a > b) [a, b] = [b, a];
  if (a === b) {
    // one value: a step either side of it (not below a floor it sits on)
    a -= 1;
    b += 1;
    if (floor != null && lo >= floor) a = Math.max(floor, a);
  }
  const step = niceStep((b - a) / count, integer);
  const decimals = placesOf(step);
  const round = (v) => Number(v.toFixed(decimals));
  let min = round(Math.floor(a / step + 1e-9) * step);
  let max = round(Math.ceil(b / step - 1e-9) * step);
  if (floor != null && lo >= floor && min < floor) min = floor;
  if (ceil != null && hi <= ceil && max > ceil) max = ceil;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(round(v));
  if (ticks[ticks.length - 1] > max) ticks[ticks.length - 1] = max;
  return { min, max, step, ticks, decimals };
}
