/**
 * Date ranges for the Statistics tab. Pure: the caller passes `now`.
 * Custom dates are "YYYY-MM-DD" strings from <input type="date"> and are
 * read as local days, both ends inclusive.
 */

const DAY = 86400000;

export const PERIODS = [
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

export const DEFAULT_PERIOD = "30d";

function localDay(s, endOfDay = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

/** { from: Date|null, to: Date|null } for a period; null means open-ended. */
export function periodBounds(period, now = new Date(), custom = {}) {
  if (period === "30d") return { from: new Date(now - 30 * DAY), to: null };
  if (period === "90d") return { from: new Date(now - 90 * DAY), to: null };
  if (period === "custom") {
    let from = localDay(custom.from);
    let to = localDay(custom.to, true);
    if (from && to && from > to) [from, to] = [localDay(custom.to), localDay(custom.from, true)];
    return { from, to };
  }
  return { from: null, to: null };
}

export function inPeriod(iso, { from, to }) {
  if (!from && !to) return true;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  return (!from || t >= from) && (!to || t <= to);
}

export function filterByPeriod(rows, bounds) {
  if (!bounds.from && !bounds.to) return rows || [];
  return (rows || []).filter((r) => inPeriod(r.completedAt, bounds));
}

const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Heading text for the chosen range, e.g. "Last 30 days", "Mar 1, 2026 – Now". */
export function periodLabel(period, bounds) {
  if (period === "30d") return "Last 30 days";
  if (period === "90d") return "Last 90 days";
  if (period === "custom") {
    if (!bounds.from && !bounds.to) return "Custom range: pick dates";
    return `${bounds.from ? fmt(bounds.from) : "Start"} – ${bounds.to ? fmt(bounds.to) : "Now"}`;
  }
  return "All time";
}

/** "YYYY-MM-DD" for a Date, in local time (for date inputs). */
export function toInputDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
