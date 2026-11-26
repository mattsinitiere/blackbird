// The range a profile's Ranked statistics open on while browsing profiles.
//
// The first profile opens on the smart default (the shortest range that holds
// a ranked game, see openingPeriod). Once you pick a range it is remembered
// for the session and every profile you open after that starts on it, unless
// that player has no ranked games in it: then the smart default again, so a
// profile never opens on an empty page because of a range picked elsewhere.

import { openingPeriod, periodBounds, inPeriod } from "./period.js";

const NO_DATES = { from: "", to: "" };

/**
 * { period, custom, remembered } to open on. `remembered` is the range picked
 * earlier this session ({ period, custom }) or null; `rows` are this player's
 * ranked rows. `remembered` in the result says whether the picked range won.
 */
export function openingRange(remembered, rows, now = new Date()) {
  if (remembered?.period) {
    const custom = remembered.period === "custom" ? { ...NO_DATES, ...remembered.custom } : NO_DATES;
    const bounds = periodBounds(remembered.period, now, custom);
    if ((rows || []).some((r) => inPeriod(r.completedAt, bounds))) return { period: remembered.period, custom, remembered: true };
  }
  return { period: openingPeriod(rows, now), custom: NO_DATES, remembered: false };
}
