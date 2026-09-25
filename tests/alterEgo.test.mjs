import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ALTER_EGO_ID,
  ALTER_EGO_VERSION,
  ALTER_EGO_MIN,
  WINDOWS,
  WINDOW_LABELS,
  eligibleRows,
  windowRows,
  buildProfile,
  sigmaForScoringAvg,
  sigmaForDoubleRate,
  alterEgoBot,
  throwForAlterEgo,
  isCheckoutAttempt,
  frozenConfig,
  botFromConfig,
  describeProfile,
  MODES,
  ALTER_EGO_MIN_ROUNDS,
  sigmaForCricketMPR,
  sigmaForBaseballRPI,
  simulatedCricketMPR,
  simulatedBaseballRPI,
} from "../lib/alterEgo.js";
import { mulberry32, throwAt } from "../lib/simulator.js";
import { aimPoint } from "../lib/board.js";
import { pickX01Target } from "../lib/botStrategy.js";
import { replayX01Visits } from "../lib/x01log.js";
import { isBot } from "../lib/bots.js";

const value = (d) => (d.n === 0 ? 0 : d.n === 25 ? 25 * d.mult : d.n * d.mult);
const ME = "alice";
const NOW = new Date("2026-09-25T17:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** Simulate one 501 double-out leg for a thrower with `sigma`, PlayX01 rules. Returns the flat dart log. */
function simulateLeg(sigma, rng, start = 501) {
  const log = [];
  let score = start;
  while (log.length < 300) {
    let rem = score;
    let ended = false;
    for (let k = 0; k < 3; k++) {
      const target = pickX01Target({ remaining: rem, doubleOut: true, checkout: 1 }, rng);
      const l = throwAt(aimPoint(target.n, target.mult), sigma, rng);
      log.push({ n: l.n, mult: l.mult });
      const next = rem - value(l);
      if (next === 0 && l.mult === 2) return log;
      if (next < 2) {
        ended = true; // bust: score unchanged
        break;
      }
      rem = next;
    }
    if (!ended) score = rem;
  }
  return log;
}

let gameSeq = 0;
function row({ username = ME, at, sigma = 18, seed = 1, opponents = [], legacy = false, noLog = false, gameType = "x01", config = {} }) {
  const cfg = { startScore: 501, doubleOut: true, legs: 1, ...config };
  const rng = mulberry32(seed);
  const log = noLog ? [] : simulateLeg(sigma, rng, cfg.startScore);
  const visits = replayX01Visits(log, cfg.startScore, cfg.doubleOut);
  const stats = noLog ? { dartsThrown: 30, pointsScored: 501 } : legacy ? { darts: log } : { v: 2, visits };
  return {
    id: ++gameSeq,
    gameId: `g${gameSeq}`,
    username,
    gameType,
    config: cfg,
    winner: username,
    result: "practice",
    opponents,
    stats,
    eloAfter: 1000,
    completedAt: new Date(at).toISOString(),
  };
}

/** n daily games ending the day before NOW. */
function history(n, opts = {}) {
  return Array.from({ length: n }, (_, i) => row({ at: NOW.getTime() - (n - i) * DAY, seed: 100 + i, ...opts }));
}

test("constants and windows", () => {
  assert.equal(ALTER_EGO_ID, "bot:alterego");
  assert.ok(isBot(ALTER_EGO_ID));
  assert.equal(ALTER_EGO_VERSION, 1);
  assert.deepEqual({ ...ALTER_EGO_MIN }, { games: 5, scoringDarts: 150, checkoutChances: 8 });
  assert.deepEqual(WINDOWS, ["last10", "last30d", "prevMonth"]);
  assert.equal(WINDOW_LABELS.last10, "Last 10 eligible games");
  assert.equal(WINDOW_LABELS.last30d, "Last 30 days");
  assert.equal(WINDOW_LABELS.prevMonth, "Previous calendar month");
});

test("insufficient data → ok:false with have/need", () => {
  const p = buildProfile(history(3), { me: ME, window: "last10", now: NOW });
  assert.equal(p.ok, false);
  assert.equal(p.reason, "not-enough-games");
  assert.equal(p.have.games, 3);
  assert.ok(p.have.scoringDarts > 0);
  assert.deepEqual(p.need, { ...ALTER_EGO_MIN });
  assert.match(describeProfile(p), /Not enough/);

  const none = buildProfile([], { me: ME, window: "last10", now: NOW });
  assert.equal(none.ok, false);
  assert.deepEqual(none.have, { games: 0, scoringDarts: 0, checkoutChances: 0 });

  // thresholds are configurable
  const strict = buildProfile(history(6), { me: ME, window: "last10", now: NOW, min: { scoringDarts: 1e6 } });
  assert.equal(strict.ok, false);
  assert.equal(strict.reason, "not-enough-scoring-darts");
});

test("a sufficient history builds a sane profile", () => {
  const p = buildProfile(history(12, { sigma: 18 }), { me: ME, window: "last10", now: NOW });
  assert.equal(p.ok, true);
  assert.equal(p.version, ALTER_EGO_VERSION);
  assert.equal(p.games, 10);
  assert.ok(p.scoringDarts >= 150);
  assert.ok(p.checkoutChances >= 8);
  assert.ok(p.checkoutHits <= 10);
  assert.ok(p.scoringAvg > 40 && p.scoringAvg < 75, `avg ${p.scoringAvg}`);
  // the fitted scoring sigma lands near the thrower's true sigma (setup shots in 101–170 blur it a little)
  assert.ok(Math.abs(p.sigmaScoring - 18) < 6, `sigmaScoring ${p.sigmaScoring}`);
  assert.ok(p.sigmaFinish >= 3 && p.sigmaFinish <= 120);
  assert.deepEqual(p.coverage, { rowsConsidered: 10, rowsWithLogs: 10, rowsWithoutLogs: 0 });
  const text = describeProfile(p);
  assert.match(text, /^Based on your last 10 eligible games \(/);
  assert.match(text, /scoring average, \d+% of checkout darts hit\.$/);
  assert.doesNotMatch(text, /exact|copy|clone/i);
});

test("legacy flat logs are replayed and used", () => {
  const rows = history(8, { legacy: true });
  assert.equal(eligibleRows(rows, ME).length, 8);
  const p = buildProfile(rows, { me: ME, window: "last10", now: NOW });
  const v2 = buildProfile(history(8), { me: ME, window: "last10", now: NOW });
  // the same simulated games stored as a flat log or as v2 visits give the same profile
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.games, 8);
  for (const k of ["scoringDarts", "scoringAvg", "checkoutChances", "checkoutHits", "sigmaScoring", "sigmaFinish"]) assert.equal(p[k], v2[k], k);
});

test("window: last10 picks the newest 10 eligible", () => {
  const rows = history(15);
  const w = windowRows(eligibleRows(rows, ME), "last10", NOW);
  assert.equal(w.rows.length, 10);
  assert.deepEqual(
    w.rows.map((r) => r.id),
    rows.slice(5).map((r) => r.id),
  );
  assert.equal(w.from, rows[5].completedAt);
  assert.equal(w.to, rows[14].completedAt);
  // input order does not matter
  const shuffled = [...rows].reverse();
  assert.deepEqual(windowRows(shuffled, "last10", NOW).rows.map((r) => r.id), w.rows.map((r) => r.id));
});

test("window: last30d boundary is exactly 30×24h", () => {
  const edge = row({ at: NOW.getTime() - 30 * DAY, seed: 1 });
  const out = row({ at: NOW.getTime() - 30 * DAY - 1000, seed: 2 });
  const fresh = row({ at: NOW.getTime() - 1000, seed: 3 });
  const future = row({ at: NOW.getTime() + DAY, seed: 4 });
  const w = windowRows([out, edge, fresh, future], "last30d", NOW);
  assert.deepEqual(w.rows.map((r) => r.id), [edge.id, fresh.id]);
});

test("window: prevMonth uses calendar months in the given timezone", () => {
  // now = 2026-09-25 → previous month is August 2026 in Chicago (CDT, UTC-5)
  const julLast = row({ at: "2026-08-01T04:59:00Z", seed: 1 }); // Jul 31 23:59 CDT
  const augFirst = row({ at: "2026-08-01T05:00:00Z", seed: 2 }); // Aug 1 00:00 CDT
  const augLast = row({ at: "2026-09-01T04:59:00Z", seed: 3 }); // Aug 31 23:59 CDT
  const sepFirst = row({ at: "2026-09-01T05:00:00Z", seed: 4 }); // Sep 1 00:00 CDT
  const w = windowRows([julLast, augFirst, augLast, sepFirst], "prevMonth", NOW, "America/Chicago");
  assert.deepEqual(w.rows.map((r) => r.id), [augFirst.id, augLast.id]);
  // the same instants in UTC put julLast in August and augLast in September
  const u = windowRows([julLast, augFirst, augLast, sepFirst], "prevMonth", NOW, "UTC");
  assert.deepEqual(u.rows.map((r) => r.id), [julLast.id, augFirst.id]);
});

test("window: prevMonth across a DST change (November 2025, America/Chicago)", () => {
  const now = new Date("2025-12-10T18:00:00Z");
  // Nov 1 starts in CDT (UTC-5); DST ends Nov 2; Nov 30 ends in CST (UTC-6)
  const octLast = row({ at: "2025-11-01T04:59:59Z", seed: 1 }); // Oct 31 23:59:59 CDT
  const novFirst = row({ at: "2025-11-01T05:00:00Z", seed: 2 }); // Nov 1 00:00 CDT
  const dstDay = row({ at: "2025-11-02T07:30:00Z", seed: 3 }); // Nov 2 01:30 CST (after fall-back)
  const novLast = row({ at: "2025-12-01T05:59:59Z", seed: 4 }); // Nov 30 23:59:59 CST
  const decFirst = row({ at: "2025-12-01T06:00:00Z", seed: 5 }); // Dec 1 00:00 CST
  const w = windowRows([octLast, novFirst, dstDay, novLast, decFirst], "prevMonth", now, "America/Chicago");
  assert.deepEqual(w.rows.map((r) => r.id), [novFirst.id, dstDay.id, novLast.id]);
  // January → previous December of the prior year
  const jan = new Date("2026-01-05T12:00:00Z");
  const w2 = windowRows([novLast, decFirst], "prevMonth", jan, "America/Chicago");
  assert.deepEqual(w2.rows.map((r) => r.id), [decFirst.id]);
});

test("exclusions: Alter Ego games, other players, other game types; logless rows only in coverage", () => {
  const mine = history(6);
  const vsAlterEgo = row({ at: NOW.getTime() - 3 * 3600e3, seed: 50, opponents: [ALTER_EGO_ID], sigma: 5 });
  const vsAlterEgoCfg = row({ at: NOW.getTime() - 2 * 3600e3, seed: 51, config: { alterEgo: { v: 1 } }, sigma: 5 });
  const someoneElse = row({ username: "bob", at: NOW.getTime() - 3600e3, seed: 52, sigma: 5 });
  const cricket = row({ at: NOW.getTime() - 4 * 3600e3, seed: 53, gameType: "cricket" });
  const noLog = row({ at: NOW.getTime() - 5 * 3600e3, seed: 54, noLog: true });
  const vsBot = row({ at: NOW.getTime() - 6 * 3600e3, seed: 55, opponents: ["bot:jay"] });
  const all = [...mine, vsAlterEgo, vsAlterEgoCfg, someoneElse, cricket, noLog, vsBot];

  const el = eligibleRows(all, ME);
  const ids = new Set(el.map((r) => r.id));
  assert.equal(el.length, 7); // 6 + vsBot
  assert.ok(ids.has(vsBot.id));
  for (const r of [vsAlterEgo, vsAlterEgoCfg, someoneElse, cricket, noLog]) assert.ok(!ids.has(r.id));
  assert.ok(el.every((r) => r.username === ME));

  const p = buildProfile(all, { me: ME, window: "last30d", now: NOW });
  assert.equal(p.ok, true);
  assert.equal(p.games, 7);
  assert.deepEqual(p.coverage, { rowsConsidered: 8, rowsWithLogs: 7, rowsWithoutLogs: 1 });

  // bob's sharp darts never leak into alice's profile
  const without = buildProfile([...mine, vsBot], { me: ME, window: "last30d", now: NOW });
  assert.equal(p.scoringAvg, without.scoringAvg);
  assert.equal(p.checkoutDartRate, without.checkoutDartRate);
  assert.equal(eligibleRows(all, undefined).length, 0);
});

test("calibration: sigmaForScoringAvg is monotonic and clamped", () => {
  let prev = Infinity;
  for (let a = 25; a <= 140; a += 5) {
    const s = sigmaForScoringAvg(a);
    assert.ok(s <= prev, `sigma(${a}) = ${s} > ${prev}`);
    assert.ok(s >= 3 && s <= 120);
    prev = s;
  }
  assert.equal(sigmaForScoringAvg(1), 120);
  assert.equal(sigmaForScoringAvg(179), 3);
  assert.equal(sigmaForScoringAvg(60), sigmaForScoringAvg(60.04)); // memoized per 0.1
  let prevD = Infinity;
  for (const r of [0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
    const s = sigmaForDoubleRate(r);
    assert.ok(s <= prevD);
    prevD = s;
  }
  assert.equal(sigmaForDoubleRate(0), sigmaForDoubleRate(0.01));
  assert.equal(sigmaForDoubleRate(1), 3); // 0.95 is out of reach even at 3 mm
});

test("calibration fit: simulated bot reproduces target scoring avg (±3) and double rate (±0.05)", () => {
  for (const scoringAvg of [30, 45, 60, 75, 90]) {
    for (const checkoutDartRate of [0.1, 0.25, 0.4]) {
      const bot = alterEgoBot({
        ok: true,
        version: 1,
        window: "last10",
        from: null,
        to: null,
        games: 10,
        scoringDarts: 300,
        checkoutChances: 30,
        scoringAvg,
        checkoutDartRate,
        sigmaScoring: sigmaForScoringAvg(scoringAvg),
        sigmaFinish: sigmaForDoubleRate(checkoutDartRate),
      });
      // 5000 visits of scoring darts at T20 (independent seed from the fit)
      const rng = mulberry32(777 + scoringAvg);
      let pts = 0;
      const N = 5000 * 3;
      for (let i = 0; i < N; i++) pts += value(throwForAlterEgo(bot, { n: 20, mult: 3 }, 501, true, rng));
      const avg = (pts / N) * 3;
      assert.ok(Math.abs(avg - scoringAvg) <= 3, `avg target ${scoringAvg}: simulated ${avg.toFixed(2)}`);
      // 5000 double attempts, alternating D16 (32 left) and D20 (40 left)
      const rng2 = mulberry32(4242 + Math.round(checkoutDartRate * 100));
      let hits = 0;
      for (let i = 0; i < 5000; i++) {
        const n = i % 2 ? 20 : 16;
        const l = throwForAlterEgo(bot, { n, mult: 2 }, 2 * n, true, rng2);
        if (l.n === n && l.mult === 2) hits++;
      }
      const rate = hits / 5000;
      assert.ok(Math.abs(rate - checkoutDartRate) <= 0.05, `rate target ${checkoutDartRate}: simulated ${rate.toFixed(3)}`);
    }
  }
});

test("checkout-attempt rule picks the finishing sigma", () => {
  assert.equal(isCheckoutAttempt({ n: 16, mult: 2 }, 32, true), true);
  assert.equal(isCheckoutAttempt({ n: 25, mult: 2 }, 50, true), true);
  assert.equal(isCheckoutAttempt({ n: 20, mult: 2 }, 40, false), true); // straight out, exact double
  assert.equal(isCheckoutAttempt({ n: 25, mult: 2 }, 110, true), false); // setup bull
  assert.equal(isCheckoutAttempt({ n: 20, mult: 3 }, 60, true), false);
  assert.equal(isCheckoutAttempt({ n: 9, mult: 1 }, 25, true), false);
  // with sigmaFinish 0-ish vs huge sigma, the attempt uses sigmaFinish
  const bot = { sigma: 1000, sigmaFinish: 0.001 };
  const l = throwForAlterEgo(bot, { n: 16, mult: 2 }, 32, true, mulberry32(1));
  assert.deepEqual([l.n, l.mult], [16, 2]);
  const bot2 = { sigma: 0.001, sigmaFinish: 1000 };
  const l2 = throwForAlterEgo(bot2, { n: 20, mult: 3 }, 301, true, mulberry32(1));
  assert.deepEqual([l2.n, l2.mult], [20, 3]);
});

test("frozen: botFromConfig(frozenConfig(p)) equals the profile's bot and survives JSON", () => {
  const p = buildProfile(history(10, { sigma: 25 }), { me: ME, window: "last10", now: NOW });
  assert.equal(p.ok, true);
  const bot = alterEgoBot(p);
  assert.equal(bot.id, ALTER_EGO_ID);
  assert.equal(bot.name, "Alter Ego");
  assert.equal(bot.level, 0);
  assert.equal(bot.checkout, 1);
  assert.equal(bot.avg, Math.round(p.scoringAvg));
  assert.equal(bot.sigma, p.sigmaScoring);
  assert.equal(bot.sigmaFinish, p.sigmaFinish);
  assert.equal(typeof bot.color, "string");
  assert.equal(typeof bot.blurb, "string");

  const cfg = frozenConfig(p);
  assert.deepEqual(Object.keys(cfg).sort(), ["checkoutChances", "checkoutDartRate", "from", "games", "scoringAvg", "scoringDarts", "sigmaFinish", "sigmaScoring", "to", "v", "window"].sort());
  assert.deepEqual(botFromConfig(cfg), bot);
  const resumed = JSON.parse(JSON.stringify({ config: { alterEgo: cfg } }));
  assert.deepEqual(botFromConfig(resumed.config.alterEgo), bot);
  // frozen: a stored snapshot is used as-is, not re-derived
  const tampered = { ...cfg, scoringAvg: 99, sigmaScoring: 42 };
  assert.equal(botFromConfig(tampered).sigma, 42);
  assert.equal(botFromConfig(null), null);
  assert.equal(botFromConfig({ sigmaScoring: "x" }), null);
  assert.equal(frozenConfig({ ok: false }), null);
});

test("describeProfile wording per window", () => {
  const base = { ok: true, games: 8, scoringAvg: 52.44, checkoutDartRate: 0.183, from: "2026-08-02T20:00:00Z", to: "2026-09-20T20:00:00Z" };
  assert.equal(describeProfile({ ...base, window: "last10" }), "Based on your last 8 eligible games (Aug 2 – Sep 20): 52.4 scoring average, 18% of checkout darts hit.");
  assert.match(describeProfile({ ...base, window: "last30d" }), /^Based on your last 30 days \(8 games, Aug 2 – Sep 20\)/);
  assert.match(describeProfile({ ...base, window: "prevMonth", to: "2026-08-30T20:00:00Z" }), /^Based on your games in August 2026 \(8 games\)/);
});

test("no network: the module imports only pure local modules", () => {
  const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
  const src = read("../lib/alterEgo.js");
  const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./board.js", "./botStrategy.js", "./darts.js", "./simulator.js", "./x01log.js"]);
  for (const f of ["../lib/alterEgo.js", "../lib/board.js", "../lib/botStrategy.js", "../lib/darts.js", "../lib/simulator.js", "../lib/x01log.js"]) {
    const s = read(f);
    assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|supabase|WebSocket/i, f);
  }
});

// ---------------------------------------------------------------------------
// Cricket and Baseball

const roundsRow = (mode, i, { hits, rounds, user = ME, extra = {} } = {}) => ({
  username: user,
  gameType: mode,
  result: "practice",
  completedAt: new Date(NOW.getTime() - (i + 1) * 86400e3).toISOString(),
  opponents: ["bot:rook"],
  config: mode === "cricket" ? { variant: "standard" } : {},
  stats: mode === "cricket" ? { marks: hits, rounds, dartsThrown: rounds * 3 } : { runs: hits, innings: rounds, dartsThrown: rounds * 3 },
  ...extra,
});

test("cricket and baseball: modes exist and thresholds say what is missing", () => {
  assert.deepEqual(MODES, ["x01", "cricket", "baseball"]);
  const few = [0, 1, 2].map((i) => roundsRow("cricket", i, { hits: 40, rounds: 20 }));
  const p = buildProfile(few, { me: ME, now: NOW, mode: "cricket" });
  assert.equal(p.ok, false);
  assert.equal(p.reason, "not-enough-games");
  assert.deepEqual(p.need, { ...ALTER_EGO_MIN_ROUNDS });
  assert.match(describeProfile(p), /Not enough Cricket play yet: 3\/5 games, 60\/50 rounds/);
  const short = [0, 1, 2, 3, 4].map((i) => roundsRow("baseball", i, { hits: 20, rounds: 9 }));
  const b = buildProfile(short, { me: ME, now: NOW, mode: "baseball" });
  assert.equal(b.reason, "not-enough-rounds", "45 innings is below 50");
  assert.match(describeProfile(b), /45\/50 innings/);
});

test("cricket: profile is marks per round over the window; exclusions hold", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => roundsRow("cricket", i, { hits: 36, rounds: 20 })), // 1.8 MPR
    roundsRow("cricket", 7, { hits: 90, rounds: 10, user: "bob" }),
    roundsRow("cricket", 8, { hits: 90, rounds: 10, extra: { opponents: [ALTER_EGO_ID] } }),
    roundsRow("cricket", 9, { hits: 90, rounds: 10, extra: { stats: { mpr: 9 } } }), // no marks/rounds: coverage only
    roundsRow("baseball", 1, { hits: 90, rounds: 9 }),
    { ...roundsRow("cricket", 10, { hits: 90, rounds: 10 }), gameType: "x01" },
  ];
  assert.equal(eligibleRows(rows, ME, "cricket").length, 6);
  const p = buildProfile(rows, { me: ME, now: NOW, mode: "cricket", window: "last30d" });
  assert.equal(p.ok, true);
  assert.equal(p.mode, "cricket");
  assert.equal(p.perRound, 1.8);
  assert.equal(p.rounds, 120);
  assert.equal(p.coverage.rowsWithoutLogs, 1);
  assert.match(describeProfile(p), /1\.80 marks per round over 120 rounds/);
});

test("calibration fit (cricket): whole simulated legs at the fitted sigma reproduce the target MPR (±0.1, independent seed)", () => {
  for (const mpr of [0.8, 1.5, 2.5, 3.4]) {
    const sigma = sigmaForCricketMPR(mpr);
    const got = simulatedCricketMPR(sigma, { seed: 4242 });
    assert.ok(Math.abs(got - mpr) <= 0.1, `target ${mpr}: sigma ${sigma} gives ${got.toFixed(3)}`);
  }
  assert.ok(sigmaForCricketMPR(1) > sigmaForCricketMPR(2), "a better MPR needs a tighter grouping");
});

test("calibration fit (baseball): the fitted sigma reproduces the target runs per inning (±0.1, independent seed)", () => {
  for (const rpi of [0.8, 2, 3.5, 5]) {
    const sigma = sigmaForBaseballRPI(rpi);
    const got = simulatedBaseballRPI(sigma, { seed: 4242 });
    assert.ok(Math.abs(got - rpi) <= 0.1, `target ${rpi}: sigma ${sigma} gives ${got.toFixed(3)}`);
  }
});

test("baseball: the frozen bot, aiming like the ladder bots, scores about the profile's runs per inning", () => {
  const rows = Array.from({ length: 6 }, (_, i) => roundsRow("baseball", i, { hits: 27, rounds: 9 })); // 3 runs per inning
  const p = buildProfile(rows, { me: ME, now: NOW, mode: "baseball" });
  assert.equal(p.perRound, 3);
  const bot = botFromConfig(JSON.parse(JSON.stringify(frozenConfig(p))));
  const rng = mulberry32(77);
  let runs = 0;
  const innings = 3000;
  for (let k = 0; k < innings; k++) {
    const n = (k % 9) + 1;
    for (let d = 0; d < 3; d++) {
      const l = throwAt(aimPoint(n, 3), bot.sigma, rng);
      if (l.n === n) runs += l.mult;
    }
  }
  assert.ok(Math.abs(runs / innings - 3) <= 0.15, `got ${(runs / innings).toFixed(2)}`);
});

test("frozen cricket/baseball configs survive JSON (resume); X01 configs without a mode still build the X01 bot", () => {
  const rows = Array.from({ length: 6 }, (_, i) => roundsRow("cricket", i, { hits: 30, rounds: 12 }));
  const p = buildProfile(rows, { me: ME, now: NOW, mode: "cricket" });
  const cfg = frozenConfig(p);
  assert.deepEqual(Object.keys(cfg).sort(), ["from", "games", "mode", "perRound", "rounds", "sigma", "to", "v", "window"]);
  const bot = botFromConfig(JSON.parse(JSON.stringify(cfg)));
  assert.equal(bot.id, ALTER_EGO_ID);
  assert.equal(bot.mode, "cricket");
  assert.equal(bot.sigma, cfg.sigma);
  assert.match(bot.blurb, /2\.50 marks per round/);
  assert.equal(botFromConfig({ mode: "cricket", sigma: -1, perRound: 2 }), null);
  const legacy = botFromConfig({ v: 1, sigmaScoring: 20, sigmaFinish: 25, scoringAvg: 60, checkoutDartRate: 0.3 });
  assert.equal(legacy.sigma, 20);
  assert.equal(legacy.sigmaFinish, 25);
  assert.throws(() => buildProfile([], { me: ME, mode: "killer" }), /unknown Alter Ego mode/);
});
