/**
 * Training plans: the catalog of drills a plan may contain, strict
 * validation of a plan definition (from Merlin or the builder), session
 * time estimates, the player's baseline, a starter assessment plan, and
 * progress. Pure: no network, shared by the browser and the server.
 *
 * A saved plan is immutable (supabase/migration-training-plans.sql).
 * Progress lives separately in plan_completions: one row per finished
 * item, written only after that game's result is saved.
 */

import { BOTS } from "./bots.js";
import { SCORING_TARGETS, SCORING_TURNS } from "./drills.js";
import { WINDOWS as ALTER_EGO_WINDOWS, WINDOW_LABELS as ALTER_EGO_WINDOW_LABELS } from "./alterEgo.js";
import { describeGame } from "./aiSummary.js";

export const PLAN_SCHEMA_VERSION = 1;
export const MAX_PLANS = 3;
export const LIMIT_MESSAGE = "You have reached your limit of 3 training plans. Delete a plan to create another.";
export const PLAN_BOUNDS = { weeks: [1, 6], perWeek: [1, 5], sessions: [1, 24], itemsPerSession: [1, 4], title: 60, goalText: 140, sessionTitle: 40, notes: 200, why: 400, bytes: 12000 };

export const GOALS = [
  { id: "finishing", label: "Doubles & Finishing", focus: "x01" },
  { id: "scoring", label: "Heavier Scoring", focus: "x01" },
  { id: "x01", label: "All-Round X01", focus: "x01" },
  { id: "cricket", label: "Cricket", focus: "cricket" },
  { id: "consistency", label: "Consistency", focus: "general" },
  { id: "assessment", label: "Assessment", focus: "general" },
];
export const SESSION_MINUTES = [15, 30, 45, 60];

const BOT_IDS = BOTS.map((b) => b.id);

/**
 * Every kind of item a plan can hold, with its only legal settings and a
 * time estimate in minutes. Nothing else can be saved: a model can't add a
 * game mode the app can't run.
 */
export const ITEM_KINDS = {
  checkoutDrill: { label: "Checkout Drill", options: { count: [5, 10, 20] }, minutes: (c) => ({ 5: 7, 10: 14, 20: 28 })[c.count] },
  scoringDrill: { label: "Scoring Drill", options: { target: SCORING_TARGETS, turns: SCORING_TURNS }, minutes: (c) => ({ 5: 4, 10: 7, 20: 12 })[c.turns] },
  bobs27: { label: "Bob's 27", options: {}, minutes: () => 12 },
  x01: { label: "Solo X01", options: { startScore: [301, 501, 701], doubleOut: [true, false] }, minutes: (c) => ({ 301: 6, 501: 10, 701: 14 })[c.startScore] },
  bot: { label: "Bot Match", options: { bot: BOT_IDS, gameType: ["x01", "cricket"] }, minutes: (c) => (c.gameType === "cricket" ? 15 : 12) },
  alterEgo: { label: "Alter Ego", options: { window: ALTER_EGO_WINDOWS }, minutes: () => 12 },
};

/** The item's display label, e.g. "Checkout Drill · 10 finishes". */
export function itemLabel(it) {
  const c = it?.config || {};
  switch (it?.type) {
    case "checkoutDrill":
      return `Checkout Drill · ${c.count} finishes`;
    case "scoringDrill":
      return `Scoring Drill · ${c.target === 25 ? "Bull" : c.target}s × ${c.turns}`;
    case "bobs27":
      return "Bob's 27";
    case "x01":
      return `Solo ${c.startScore}${c.doubleOut ? "" : " (straight out)"}`;
    case "bot": {
      const b = BOTS.find((x) => x.id === c.bot);
      return `${b ? b.name : "Bot"} · ${c.gameType === "cricket" ? "Cricket" : "X01"}`;
    }
    case "alterEgo":
      return `Alter Ego · ${ALTER_EGO_WINDOW_LABELS[c.window] || c.window}`;
    default:
      return "Drill";
  }
}

export function itemMinutes(it) {
  const k = ITEM_KINDS[it?.type];
  return k ? k.minutes(it.config || {}) || 0 : 0;
}

export function sessionMinutes(s) {
  return (s?.items || []).reduce((a, it) => a + itemMinutes(it), 0);
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const inRange = (n, [lo, hi]) => Number.isInteger(n) && n >= lo && n <= hi;

/** One item, checked exactly (no snapping): { item } or { error }. */
export function validateItem(raw, where = "item") {
  if (!raw || typeof raw !== "object") return { error: `${where}: not an object` };
  const kind = ITEM_KINDS[raw.type];
  if (!kind) return { error: `${where}: unknown type "${raw.type}"; allowed: ${Object.keys(ITEM_KINDS).join(", ")}` };
  const cfgIn = raw.config && typeof raw.config === "object" ? raw.config : {};
  const config = {};
  for (const [key, allowed] of Object.entries(kind.options)) {
    let v = cfgIn[key];
    if (raw.type === "scoringDrill" && key === "target" && v === "bull") v = 25;
    if (raw.type === "x01" && key === "doubleOut" && v === undefined) v = true;
    if (!allowed.includes(v)) return { error: `${where}: ${raw.type}.${key} must be one of ${allowed.join(", ")} (got ${JSON.stringify(v)})` };
    config[key] = v;
  }
  const extra = Object.keys(cfgIn).filter((k) => !(k in kind.options));
  if (extra.length) return { error: `${where}: ${raw.type} has unsupported settings ${extra.join(", ")}` };
  return { item: { type: raw.type, config } };
}

/**
 * Validate a whole plan definition. Returns { ok: true, plan } with a
 * normalized copy (labels and minutes computed here, never trusted from
 * input) or { ok: false, errors }.
 */
export function validatePlanDefinition(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["plan: not an object"] };
  const title = str(raw.title, PLAN_BOUNDS.title);
  if (!title) errors.push("title is required");
  const goal = GOALS.find((g) => g.id === raw.goal);
  if (!goal) errors.push(`goal must be one of ${GOALS.map((g) => g.id).join(", ")}`);
  const weeks = Number(raw.weeks);
  const perWeek = Number(raw.perWeek);
  if (!inRange(weeks, PLAN_BOUNDS.weeks)) errors.push(`weeks must be ${PLAN_BOUNDS.weeks.join("–")}`);
  if (!inRange(perWeek, PLAN_BOUNDS.perWeek)) errors.push(`perWeek must be ${PLAN_BOUNDS.perWeek.join("–")}`);
  const sessionsIn = Array.isArray(raw.sessions) ? raw.sessions : [];
  const maxSessions = Math.min(PLAN_BOUNDS.sessions[1], (inRange(weeks, PLAN_BOUNDS.weeks) ? weeks : 6) * (inRange(perWeek, PLAN_BOUNDS.perWeek) ? perWeek : 5));
  if (sessionsIn.length < 1 || sessionsIn.length > maxSessions) errors.push(`sessions must hold 1–${maxSessions} sessions (weeks × perWeek, at most ${PLAN_BOUNDS.sessions[1]})`);
  const sessions = [];
  sessionsIn.slice(0, PLAN_BOUNDS.sessions[1]).forEach((s, si) => {
    const itemsIn = Array.isArray(s?.items) ? s.items : [];
    if (!inRange(itemsIn.length, PLAN_BOUNDS.itemsPerSession)) {
      errors.push(`session ${si + 1}: needs ${PLAN_BOUNDS.itemsPerSession.join("–")} items`);
      return;
    }
    const items = [];
    itemsIn.forEach((it, ii) => {
      const v = validateItem(it, `session ${si + 1} item ${ii + 1}`);
      if (v.error) errors.push(v.error);
      else items.push({ ...v.item, label: itemLabel(v.item) });
    });
    const sess = { title: str(s.title, PLAN_BOUNDS.sessionTitle) || `Session ${si + 1}`, focus: str(s.focus, 60) || null, items };
    sess.minutes = sessionMinutes(sess);
    sessions.push(sess);
  });
  if (errors.length) return { ok: false, errors };
  const plan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    title,
    goal: goal.id,
    goalText: str(raw.goalText, PLAN_BOUNDS.goalText) || goal.label,
    focus: goal.focus,
    weeks,
    perWeek,
    minutesPerSession: SESSION_MINUTES.includes(Number(raw.minutesPerSession)) ? Number(raw.minutesPerSession) : null,
    sessions,
    notes: str(raw.notes, PLAN_BOUNDS.notes) || null,
    why: str(raw.why, PLAN_BOUNDS.why) || null,
    starter: raw.starter === true,
  };
  if (JSON.stringify(plan).length > PLAN_BOUNDS.bytes) return { ok: false, errors: [`plan is too large (over ${PLAN_BOUNDS.bytes} characters)`] };
  return { ok: true, plan };
}

// ---- baseline ---------------------------------------------------------

/** Minimum sample before a baseline number is shown or used. */
export const BASELINE_MIN = { x01Games: 3, checkoutChances: 10, bobs27: 2, checkoutDrill: 2, scoringDrill: 2, cricketGames: 3 };
/** Fewer than this many relevant games: offer the starter assessment. */
export const STARTER_MIN_GAMES = 5;

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * The player's starting numbers from their own rows (camelCase game
 * results, practice included). Every value carries its sample size; values
 * below BASELINE_MIN are left null rather than guessed.
 */
export function planBaseline(rows, me, now = new Date()) {
  const mine = (rows || []).filter((r) => r.username === me);
  const x01 = mine.filter((r) => r.gameType === "x01");
  let pts = 0;
  let darts = 0;
  let chances = 0;
  let hits = 0;
  let logged = 0;
  for (const r of x01) {
    const g = describeGame(r, me);
    if (r.stats?.dartsThrown) {
      pts += r.stats.pointsScored || 0;
      darts += r.stats.dartsThrown;
    }
    if (g._rp?.valid) {
      logged++;
      chances += g._rp.chances;
      hits += g._rp.checkoutHit;
    }
  }
  const byType = (t) => mine.filter((r) => r.gameType === t);
  const bobs = byType("bobs27");
  const co = byType("checkoutDrill");
  const sc = byType("scoringDrill");
  const cricket = byType("cricket");
  const coFinishes = co.reduce((a, r) => a + (r.stats?.finishes || 0), 0);
  const coHits = co.reduce((a, r) => a + (r.stats?.hit || 0), 0);
  const scTurns = sc.reduce((a, r) => a + (r.stats?.turns || 0), 0);
  const scTotal = sc.reduce((a, r) => a + (r.stats?.total || 0), 0);
  const crMarks = cricket.reduce((a, r) => a + (r.stats?.marks || 0), 0);
  const crRounds = cricket.reduce((a, r) => a + (r.stats?.rounds || 0), 0);
  const ok = (n, k) => n >= BASELINE_MIN[k];
  const dated = mine.map((r) => r.completedAt).filter(Boolean).sort();
  return {
    asOf: new Date(now).toISOString(),
    games: mine.length,
    from: dated[0] || null,
    to: dated[dated.length - 1] || null,
    x01: { games: x01.length, avg: ok(x01.length, "x01Games") && darts ? r1((pts / darts) * 3) : null, withLogs: logged },
    checkout: { chances, hits, pct: chances >= BASELINE_MIN.checkoutChances ? r1((hits / chances) * 100) : null },
    bobs27: { games: bobs.length, avg: ok(bobs.length, "bobs27") ? r1(bobs.reduce((a, r) => a + (r.stats?.finalScore || 0), 0) / bobs.length) : null },
    checkoutDrill: { games: co.length, finishes: coFinishes, hitPct: ok(co.length, "checkoutDrill") && coFinishes ? r1((coHits / coFinishes) * 100) : null },
    scoringDrill: { games: sc.length, turns: scTurns, perVisit: ok(sc.length, "scoringDrill") && scTurns ? r1(scTotal / scTurns) : null },
    cricket: { games: cricket.length, mpr: ok(cricket.length, "cricketGames") && crRounds ? Math.round((crMarks / crRounds) * 100) / 100 : null },
  };
}

/** True when there isn't enough history for a personalized plan. */
export function needsStarter(baseline) {
  return (baseline?.games || 0) < STARTER_MIN_GAMES;
}

/** A clearly labeled assessment plan for players with little history. */
export function starterPlan() {
  const v = validatePlanDefinition({
    title: "Starter Assessment",
    goal: "assessment",
    goalText: "Measure your scoring, doubles and finishing",
    weeks: 1,
    perWeek: 3,
    starter: true,
    why: "There isn't enough recorded play yet for a personalized plan. These three sessions measure your scoring, doubles and finishing, so your next plan can be built on real numbers.",
    sessions: [
      { title: "Scoring & Finishing", focus: "Scoring rhythm, then finishes", items: [{ type: "scoringDrill", config: { target: 20, turns: 10 } }, { type: "checkoutDrill", config: { count: 10 } }] },
      { title: "Doubles", focus: "Every double once", items: [{ type: "bobs27", config: {} }, { type: "x01", config: { startScore: 501, doubleOut: true } }] },
      { title: "Second Read", focus: "Repeat for a fair sample", items: [{ type: "scoringDrill", config: { target: 19, turns: 10 } }, { type: "checkoutDrill", config: { count: 10 } }] },
    ],
  });
  return v.plan;
}

// ---- progress ---------------------------------------------------------

/**
 * Progress from a saved plan definition and its completion rows
 * ({ session_idx, item_idx, completed_at }). A session counts as done only
 * when every item in it has a recorded, saved game.
 */
export function planProgress(definition, completions = []) {
  const sessions = definition?.sessions || [];
  const done = new Set((completions || []).map((c) => `${c.session_idx ?? c.sessionIdx}:${c.item_idx ?? c.itemIdx}`));
  const last = (completions || []).reduce((a, c) => {
    const t = c.completed_at || c.completedAt;
    return t && (!a || t > a) ? t : a;
  }, null);
  const perSession = sessions.map((s, si) => {
    const items = s.items.map((_, ii) => done.has(`${si}:${ii}`));
    const n = items.filter(Boolean).length;
    return { items, done: n, total: items.length, complete: n === items.length, started: n > 0 };
  });
  const completeCount = perSession.filter((p) => p.complete).length;
  const inProgress = perSession.findIndex((p) => p.started && !p.complete);
  const next = inProgress >= 0 ? inProgress : perSession.findIndex((p) => !p.complete);
  const nextItem = next >= 0 ? perSession[next].items.findIndex((x) => !x) : -1;
  return {
    sessions: perSession,
    completeSessions: completeCount,
    totalSessions: sessions.length,
    completed: sessions.length > 0 && completeCount === sessions.length,
    inProgressSession: inProgress >= 0 ? inProgress : null,
    nextSession: next >= 0 ? next : null,
    nextItem: nextItem >= 0 ? nextItem : null,
    lastActivity: last,
    pct: sessions.length ? Math.round((completeCount / sessions.length) * 100) : 0,
  };
}

/**
 * The game to launch for a plan item: { gameType, config, bot?, alterEgo? }.
 * The plan link rides in config.plan so the saved result points back to it.
 */
export function launchSpec(planId, sessionIdx, itemIdx, item, total) {
  const link = { id: planId, s: sessionIdx, i: itemIdx, n: total };
  const c = item.config || {};
  switch (item.type) {
    case "checkoutDrill":
      return { gameType: "checkoutDrill", config: { count: c.count, plan: link } };
    case "scoringDrill":
      return { gameType: "scoringDrill", config: { target: c.target, turns: c.turns, plan: link } };
    case "bobs27":
      return { gameType: "bobs27", config: { plan: link } };
    case "x01":
      return { gameType: "x01", config: { startScore: c.startScore, doubleOut: c.doubleOut, legs: 1, plan: link } };
    case "bot":
      return { gameType: c.gameType, bot: c.bot, config: { plan: link } };
    case "alterEgo":
      return { gameType: "x01", alterEgo: { window: c.window }, config: { plan: link } };
    default:
      return null;
  }
}
