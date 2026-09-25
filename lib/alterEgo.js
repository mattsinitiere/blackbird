import { throwAt, mulberry32 } from "./simulator.js";
import { aimPoint } from "./board.js";
import { dartValue } from "./darts.js";
import { replayX01Visits, isFinishable, isDoubleFinish } from "./x01log.js";

/**
 * Alter Ego: a practice X01 opponent that approximates the player's OWN
 * recent form. Not AI-driven: the player's logged darts are reduced to two
 * numbers (a scoring average and a checkout-dart hit rate), each of which is
 * mapped by seeded Monte Carlo bisection to a Gaussian landing error (sigma,
 * mm) for the existing throw simulator (lib/simulator.js).
 *
 * Only the requesting player's own rows are read (username === me), and
 * only the per-player stats stored in that row, so another player's darts
 * (or a bot's) can never enter. Games played against the Alter Ego itself
 * are excluded so the opponent never learns from itself.
 *
 * See docs/ALTER_EGO.md. Pure: no React, no network, deterministic.
 */

export const ALTER_EGO_ID = "bot:alterego";
export const ALTER_EGO_VERSION = 1;

/** Minimum evidence before a profile is built. Override via buildProfile(rows, { min }). */
export const ALTER_EGO_MIN = Object.freeze({ games: 5, scoringDarts: 150, checkoutChances: 8 });

export const WINDOWS = ["last10", "last30d", "prevMonth"];
export const WINDOW_LABELS = {
  last10: "Last 10 eligible games",
  last30d: "Last 30 days",
  prevMonth: "Previous calendar month",
};

export const DEFAULT_TZ = "America/Chicago";

/** Sigma search range (mm) and the simulation behind each fit. */
export const SIGMA_RANGE = Object.freeze({ min: 3, max: 120 });
export const CALIBRATION = Object.freeze({ darts: 20000, seed: 1234, iterations: 30 });
export const RATE_RANGE = Object.freeze({ min: 0.01, max: 0.95 });

const ALTER_EGO_COLOR = "#0f766e";
const DAY_MS = 24 * 60 * 60 * 1000;

const round = (x, d) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const timeOf = (r) => {
  const t = Date.parse(r?.completedAt);
  return Number.isNaN(t) ? null : t;
};

// ---------------------------------------------------------------------------
// Eligibility

function isAlterEgoGame(row) {
  return (Array.isArray(row?.opponents) && row.opponents.includes(ALTER_EGO_ID)) || !!row?.config?.alterEgo;
}

/** The player's own X01 rows, excluding games against the Alter Ego. Logs not checked. */
function candidateRows(rows, me) {
  return (rows || []).filter(
    (r) => r && me != null && r.username === me && r.gameType === "x01" && !isAlterEgoGame(r) && timeOf(r) != null,
  );
}

/**
 * The usable dart log of one row, as v2 visits, or null. Reads only
 * row.stats (the row owner's own per-player block) and row.config.
 */
export function rowVisits(row) {
  const st = row?.stats || {};
  const cfg = row?.config || {};
  const doubleOut = !!cfg.doubleOut;
  if (st.v >= 2 && Array.isArray(st.visits) && st.visits.length && typeof st.visits[0] === "object") {
    const visits = st.visits.filter((v) => v && typeof v.s0 === "number" && Array.isArray(v.darts));
    return visits.length ? { visits, doubleOut } : null;
  }
  const start = cfg.startScore || cfg.start;
  if (Array.isArray(st.darts) && st.darts.length && start > 0) {
    const visits = replayX01Visits(st.darts, start, doubleOut);
    return visits.length ? { visits, doubleOut } : null;
  }
  return null;
}

/** The player's own X01 rows that carry a usable dart log (see docs/ALTER_EGO.md). */
export function eligibleRows(rows, me) {
  return candidateRows(rows, me).filter((r) => rowVisits(r) != null);
}

// ---------------------------------------------------------------------------
// Windows

function ymIn(t, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(new Date(t));
  const y = Number(parts.find((p) => p.type === "year").value);
  const m = Number(parts.find((p) => p.type === "month").value);
  return y * 12 + (m - 1);
}

function selectWindow(rows, window, now, tz) {
  const nowT = now instanceof Date ? now.getTime() : Date.parse(now);
  const sorted = [...rows].sort((a, b) => timeOf(a) - timeOf(b));
  if (window === "last10") return sorted.filter((r) => timeOf(r) <= nowT).slice(-10);
  if (window === "last30d") return sorted.filter((r) => timeOf(r) <= nowT && nowT - timeOf(r) <= 30 * DAY_MS);
  if (window === "prevMonth") {
    const prev = ymIn(nowT, tz) - 1;
    return sorted.filter((r) => ymIn(timeOf(r), tz) === prev);
  }
  throw new Error(`unknown Alter Ego window: ${window}`);
}

/**
 * Rows inside a window, oldest first, with the ISO timestamps of the first
 * and last included row. last10 = newest 10 (not after `now`); last30d =
 * completed within 30×24h before `now`; prevMonth = the calendar month
 * before `now`'s month, both evaluated in `tz`.
 */
export function windowRows(rows, window, now = new Date(), tz = DEFAULT_TZ) {
  const out = selectWindow(rows || [], window, now, tz);
  return {
    rows: out,
    from: out.length ? new Date(timeOf(out[0])).toISOString() : null,
    to: out.length ? new Date(timeOf(out[out.length - 1])).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Calibration (seeded Monte Carlo + bisection, memoized)

const T20_AIM = aimPoint(20, 3);
const DOUBLE_MIX = [
  { n: 16, aim: aimPoint(16, 2) },
  { n: 20, aim: aimPoint(20, 2) },
];

/** Simulated 3-dart average at T20 for a sigma (common random numbers: same seed every call). */
export function simulatedScoringAvg(sigma, { darts = CALIBRATION.darts, seed = CALIBRATION.seed } = {}) {
  const rng = mulberry32(seed);
  let sum = 0;
  for (let i = 0; i < darts; i++) sum += dartValue(throwAt(T20_AIM, sigma, rng));
  return (sum / darts) * 3;
}

/** Simulated rate of hitting the intended double (D16/D20 alternating) for a sigma. */
export function simulatedDoubleRate(sigma, { darts = CALIBRATION.darts, seed = CALIBRATION.seed } = {}) {
  const rng = mulberry32(seed);
  let hits = 0;
  for (let i = 0; i < darts; i++) {
    const d = DOUBLE_MIX[i % DOUBLE_MIX.length];
    const l = throwAt(d.aim, sigma, rng);
    if (l.n === d.n && l.mult === 2) hits++;
  }
  return hits / darts;
}

/** Bisection for the sigma where a decreasing f(sigma) meets target; clamped to SIGMA_RANGE. */
function bisectSigma(f, target) {
  let lo = SIGMA_RANGE.min;
  let hi = SIGMA_RANGE.max;
  if (target >= f(lo)) return lo;
  if (target <= f(hi)) return hi;
  for (let i = 0; i < CALIBRATION.iterations; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > target) lo = mid;
    else hi = mid;
  }
  return round((lo + hi) / 2, 2);
}

const scoringCache = new Map();
const doubleCache = new Map();

/** Sigma (mm) whose simulated T20 3-dart average matches `avg`. Memoized per 0.1. */
export function sigmaForScoringAvg(avg) {
  const key = round(Number(avg) || 0, 1);
  if (!scoringCache.has(key)) scoringCache.set(key, bisectSigma(simulatedScoringAvg, key));
  return scoringCache.get(key);
}

/** Sigma (mm) whose simulated D16/D20 hit rate matches `rate` (clamped to [0.01, 0.95]). Memoized per 0.001. */
export function sigmaForDoubleRate(rate) {
  const key = round(clamp(Number(rate) || 0, RATE_RANGE.min, RATE_RANGE.max), 3);
  if (!doubleCache.has(key)) doubleCache.set(key, bisectSigma(simulatedDoubleRate, key));
  return doubleCache.get(key);
}

// ---------------------------------------------------------------------------
// Profile

/** Scoring and finishing evidence from one row's visits. */
function rowEvidence({ visits, doubleOut }) {
  let scoringDarts = 0;
  let scoringPoints = 0;
  let chances = 0;
  let hits = 0;
  for (const v of visits) {
    const darts = v.darts || [];
    const k = v.out?.k;
    if (v.s0 > 100) {
      scoringDarts += darts.length;
      // a bust visit scores nothing (same convention as summarizeX01Visits)
      scoringPoints += k === "bust" ? 0 : (v.out?.s ?? darts.reduce((a, d) => a + dartValue(d), 0));
    }
    // finishing is modelled as double hitting, so only double-out legs count
    if (doubleOut) {
      let rem = v.s0;
      for (const d of darts) {
        if (isFinishable(rem, true)) chances++;
        rem -= dartValue(d);
      }
      if (k === "win") hits++;
    }
  }
  return { scoringDarts, scoringPoints, chances, hits };
}

function coverageFor(rows, me, window, now, tz, included, from) {
  const cands = candidateRows(rows, me);
  let considered;
  if (window === "last10") {
    const nowT = now instanceof Date ? now.getTime() : Date.parse(now);
    const upTo = cands.filter((r) => timeOf(r) <= nowT);
    considered = included < 10 || !from ? upTo : upTo.filter((r) => timeOf(r) >= Date.parse(from));
  } else {
    considered = selectWindow(cands, window, now, tz);
  }
  const withLogs = considered.filter((r) => rowVisits(r) != null).length;
  return { rowsConsidered: considered.length, rowsWithLogs: withLogs, rowsWithoutLogs: considered.length - withLogs };
}

/**
 * Build a player's Alter Ego profile from their result rows (in-memory
 * shape, lib/practice.js resultFromRow). Returns { ok: false, reason,
 * have, need } when the window holds too little evidence.
 */
export function buildProfile(rows, { me, window = "last10", now = new Date(), tz = DEFAULT_TZ, min = ALTER_EGO_MIN } = {}) {
  const { rows: used, from, to } = windowRows(eligibleRows(rows, me), window, now, tz);
  let scoringDarts = 0;
  let scoringPoints = 0;
  let checkoutChances = 0;
  let checkoutHits = 0;
  for (const r of used) {
    const e = rowEvidence(rowVisits(r));
    scoringDarts += e.scoringDarts;
    scoringPoints += e.scoringPoints;
    checkoutChances += e.chances;
    checkoutHits += e.hits;
  }
  const coverage = coverageFor(rows, me, window, now, tz, used.length, from);
  const have = { games: used.length, scoringDarts, checkoutChances };
  const need = { ...ALTER_EGO_MIN, ...min };
  const reason =
    have.games < need.games
      ? "not-enough-games"
      : have.scoringDarts < need.scoringDarts
        ? "not-enough-scoring-darts"
        : have.checkoutChances < need.checkoutChances
          ? "not-enough-checkout-chances"
          : null;
  if (reason) return { ok: false, reason, window, have, need, coverage };

  const scoringAvg = round((scoringPoints / scoringDarts) * 3, 1);
  const checkoutDartRate = round(checkoutHits / checkoutChances, 3);
  return {
    ok: true,
    version: ALTER_EGO_VERSION,
    window,
    from,
    to,
    games: used.length,
    scoringDarts,
    scoringAvg,
    checkoutChances,
    checkoutHits,
    checkoutDartRate,
    sigmaScoring: sigmaForScoringAvg(scoringAvg),
    sigmaFinish: sigmaForDoubleRate(checkoutDartRate),
    coverage,
  };
}

// ---------------------------------------------------------------------------
// Bot

/** The minimal, frozen snapshot stored in game.config.alterEgo. */
export function frozenConfig(profile) {
  if (!profile || !profile.ok) return null;
  return {
    v: profile.version ?? ALTER_EGO_VERSION,
    window: profile.window,
    from: profile.from,
    to: profile.to,
    games: profile.games,
    scoringDarts: profile.scoringDarts,
    checkoutChances: profile.checkoutChances,
    scoringAvg: round(profile.scoringAvg, 1),
    checkoutDartRate: round(profile.checkoutDartRate, 3),
    sigmaScoring: round(profile.sigmaScoring, 2),
    sigmaFinish: round(profile.sigmaFinish, 2),
  };
}

/**
 * Rebuild the bot from a stored snapshot (resume). Uses the stored sigmas
 * as they are: never re-derives anything from data. Null when unusable.
 */
export function botFromConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const sigma = Number(cfg.sigmaScoring);
  const sigmaFinish = Number(cfg.sigmaFinish);
  const avg = Number(cfg.scoringAvg);
  if (![sigma, sigmaFinish, avg].every(Number.isFinite) || sigma <= 0 || sigmaFinish <= 0) return null;
  return {
    id: ALTER_EGO_ID,
    name: "Alter Ego",
    level: 0,
    avg: Math.round(avg),
    sigma,
    sigmaFinish,
    checkout: 1,
    color: ALTER_EGO_COLOR,
    blurb: `Throws roughly like your recent form: about ${Math.round(avg)} scoring, ${Math.round((Number(cfg.checkoutDartRate) || 0) * 100)}% on checkout darts.`,
  };
}

/** The Alter Ego bot for a profile (same object botFromConfig(frozenConfig(profile)) gives). */
export function alterEgoBot(profile) {
  return botFromConfig(frozenConfig(profile));
}

/**
 * Is this dart a checkout attempt? Rule: the target is a double (including
 * the inner bull) AND either that double finishes exactly (remaining ===
 * its value) or, playing double out, the remaining score is itself a
 * one-dart double finish (2–40 even, or 50). Everything else — scoring,
 * setup shots, a setup double like the bull from 110 — uses `sigma`.
 */
export function isCheckoutAttempt(target, remaining, doubleOut = true) {
  if (!target || target.mult !== 2) return false;
  return dartValue(target) === remaining || (!!doubleOut && isDoubleFinish(remaining));
}

/** One Alter Ego dart at `target`: sigmaFinish on checkout attempts, sigma otherwise. */
export function throwForAlterEgo(bot, target, remaining, doubleOut = true, rng = Math.random) {
  const sigma = isCheckoutAttempt(target, remaining, doubleOut) && bot.sigmaFinish > 0 ? bot.sigmaFinish : bot.sigma;
  return throwAt(aimPoint(target.n, target.mult), sigma, rng);
}

// ---------------------------------------------------------------------------
// Text

function fmtDay(iso, tz) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(new Date(iso));
}
function fmtMonth(iso, tz) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "long", year: "numeric" }).format(new Date(iso));
}

/** A modest one-line description of a profile (or of what is missing). */
export function describeProfile(profile, { tz = DEFAULT_TZ } = {}) {
  if (!profile) return "";
  if (!profile.ok) {
    const h = profile.have || {};
    const n = profile.need || ALTER_EGO_MIN;
    return `Not enough logged X01 play yet: ${h.games || 0}/${n.games} games, ${h.scoringDarts || 0}/${n.scoringDarts} scoring darts, ${h.checkoutChances || 0}/${n.checkoutChances} checkout darts.`;
  }
  const span = profile.from && profile.to ? (fmtDay(profile.from, tz) === fmtDay(profile.to, tz) ? fmtDay(profile.from, tz) : `${fmtDay(profile.from, tz)} – ${fmtDay(profile.to, tz)}`) : "";
  const games = `${profile.games} game${profile.games === 1 ? "" : "s"}`;
  const basis =
    profile.window === "last10"
      ? `your last ${profile.games} eligible game${profile.games === 1 ? "" : "s"}${span ? ` (${span})` : ""}`
      : profile.window === "last30d"
        ? `your last 30 days (${games}${span ? `, ${span}` : ""})`
        : `your games in ${profile.from ? fmtMonth(profile.from, tz) : "the previous month"} (${games})`;
  return `Based on ${basis}: ${profile.scoringAvg.toFixed(1)} scoring average, ${Math.round(profile.checkoutDartRate * 100)}% of checkout darts hit.`;
}
