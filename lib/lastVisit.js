import { isBot } from "./bots.js";

/**
 * The "last visit" line the play screens show above the keypad until the
 * next visit's first dart (components/LastVisit.js). A bot throws its
 * darts one by one while nobody is looking at the phone, so without it the
 * bot's whole visit vanishes the moment its third dart lands. Pure.
 *
 * A last visit is { by, darts: [{ n, mult }], ...what the game needs to
 * describe it }.
 */

/**
 * The last visit to show, or null: someone else's visit (only a bot's when
 * `botsOnly`), while a person is at the oche and hasn't thrown yet.
 */
export function lastVisitToShow(last, { cur, thrown = 0, botAtOche = false, botsOnly = false } = {}) {
  if (!last || last.by === cur || thrown > 0 || botAtOche) return null;
  if (botsOnly && !isBot(last.by)) return null;
  return last;
}

/** X01: { k: "normal" | "bust" | "win", s: points scored, rem: left after }. */
export function describeX01Visit({ k, s, rem }) {
  if (k === "bust") return `bust, still on ${rem}`;
  if (k === "win") return `checked out ${s}`;
  return `scored ${s}, ${rem} left`;
}

/** Cricket: { marks, pts } (pts is what the visit added; Cutthroat gives them to others). */
export function describeCricketVisit({ marks = 0, pts = 0, variant = "standard" }) {
  const m = marks === 0 ? "no marks" : `${marks} mark${marks === 1 ? "" : "s"}`;
  if (!pts) return m;
  return variant === "cutthroat" ? `${m}, ${pts} points to the others` : `${m}, +${pts} points`;
}

/** Baseball: { runs }. */
export function describeBaseballVisit({ runs = 0 }) {
  return runs === 0 ? "no runs" : `${runs} run${runs === 1 ? "" : "s"}`;
}
