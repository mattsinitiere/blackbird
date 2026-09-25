/**
 * Reporting calendar. Days, weeks (Monday start) and months are counted in
 * one timezone so the app, the AI and the daily AI allowance agree
 * (ai_take_request uses America/Chicago too). Uses Intl, so daylight-saving
 * changes are handled: a "day" is the local calendar day, 23 or 25 hours
 * long on the change dates.
 */

export const REPORT_TZ = "America/Chicago";

const fmtCache = new Map();
function fmt(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }));
  }
  return fmtCache.get(tz);
}

/** { y, m, d, hh, mm, ss } of an instant in `tz`. */
export function localParts(when, tz = REPORT_TZ) {
  const parts = {};
  for (const p of fmt(tz).formatToParts(new Date(when))) parts[p.type] = p.value;
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute, ss: +parts.second };
}

const pad = (n) => String(n).padStart(2, "0");

/** YYYY-MM-DD of the instant's local calendar day. */
export function dayKey(when, tz = REPORT_TZ) {
  const p = localParts(when, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** YYYY-MM of the instant's local month. */
export function monthKey(when, tz = REPORT_TZ) {
  const p = localParts(when, tz);
  return `${p.y}-${pad(p.m)}`;
}

/** YYYY-MM-DD of the Monday that starts the instant's local week. */
export function weekKey(when, tz = REPORT_TZ) {
  const p = localParts(when, tz);
  const civil = new Date(Date.UTC(p.y, p.m - 1, p.d));
  civil.setUTCDate(civil.getUTCDate() - ((civil.getUTCDay() + 6) % 7));
  return civil.toISOString().slice(0, 10);
}

/** Offset of `tz` from UTC at an instant, in minutes (local - UTC). */
function offsetMinutes(when, tz) {
  const p = localParts(when, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(new Date(when).getTime() / 1000) * 1000) / 60000);
}

/**
 * The UTC instant of local midnight starting the day y-m-d in `tz`. Works
 * across DST by correcting the offset once (midnight is never inside a
 * US transition, which happens at 02:00).
 */
export function startOfLocalDay(y, m, d, tz = REPORT_TZ) {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMinutes(guess, tz) * 60000;
  t = guess - offsetMinutes(t, tz) * 60000;
  return new Date(t);
}

/** [from, to) instants of the local calendar month containing `when`, shifted by `delta` months. */
export function monthRange(when, delta = 0, tz = REPORT_TZ) {
  const p = localParts(when, tz);
  const first = new Date(Date.UTC(p.y, p.m - 1 + delta, 1));
  const next = new Date(Date.UTC(p.y, p.m + delta, 1));
  return {
    from: startOfLocalDay(first.getUTCFullYear(), first.getUTCMonth() + 1, 1, tz),
    to: startOfLocalDay(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, tz),
  };
}

/** [from, to) instants of the local week (Monday start) containing `when`, shifted by `delta` weeks. */
export function weekRange(when, delta = 0, tz = REPORT_TZ) {
  const [y, m, d] = weekKey(when, tz).split("-").map(Number);
  const mon = new Date(Date.UTC(y, m - 1, d + delta * 7));
  const nextMon = new Date(Date.UTC(y, m - 1, d + delta * 7 + 7));
  return {
    from: startOfLocalDay(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate(), tz),
    to: startOfLocalDay(nextMon.getUTCFullYear(), nextMon.getUTCMonth() + 1, nextMon.getUTCDate(), tz),
  };
}

/** [from, to) of the local day window YYYY-MM-DD .. YYYY-MM-DD (inclusive days). */
export function dayWindow(fromDay, toDay, tz = REPORT_TZ) {
  const out = {};
  if (fromDay) {
    const [y, m, d] = fromDay.split("-").map(Number);
    out.from = startOfLocalDay(y, m, d, tz);
  }
  if (toDay) {
    const [y, m, d] = toDay.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    out.to = startOfLocalDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
  }
  return out;
}
