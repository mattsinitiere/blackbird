/**
 * Merlin, the Home coaching card: one answer to "what should I do next?"
 *
 * Everything here is deterministic and computed from saved records (plans,
 * plan progress, game results). No AI call is made to show the card, so it
 * works when AI is down and costs nothing to render. Observations are
 * worded as what changed "since", never as what caused it, and only when
 * both samples are big enough.
 */

import { planProgress, STARTER_MIN_GAMES, BASELINE_MIN } from "./trainingPlans.js";
import { describeGame } from "./aiSummary.js";

export const MERLIN = { name: "Merlin", tagline: "Your Blackbird Coach" };

/** Sample sizes an observation needs on both sides before Merlin mentions it. */
export const OBSERVATION_MIN = { x01Games: 5, checkoutChances: 15, avgDelta: 3, checkoutDelta: 5 };

const r1 = (v) => Math.round(v * 10) / 10;
const fmtDay = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
  } catch {
    return "";
  }
};

/** Weighted X01 3-dart average and checkout numbers over some rows. */
export function x01Numbers(rows, me) {
  let pts = 0;
  let darts = 0;
  let chances = 0;
  let hits = 0;
  let games = 0;
  for (const r of rows) {
    if (r.username !== me || r.gameType !== "x01") continue;
    games++;
    if (r.stats?.dartsThrown) {
      pts += r.stats.pointsScored || 0;
      darts += r.stats.dartsThrown;
    }
    const g = describeGame(r, me);
    if (g._rp?.valid) {
      chances += g._rp.chances;
      hits += g._rp.checkoutHit;
    }
  }
  return { games, avg: darts ? r1((pts / darts) * 3) : null, darts, chances, hits, pct: chances ? r1((hits / chances) * 100) : null };
}

/**
 * A short, evidence-based note about recent X01 form: the last 5 games
 * against the 10 before them. Null unless both samples meet the minimums
 * and the change is big enough to be worth saying.
 */
export function recentObservation(rows, me) {
  const x01 = (rows || []).filter((r) => r.username === me && r.gameType === "x01").sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  if (x01.length < OBSERVATION_MIN.x01Games * 3) return null;
  const recent = x01.slice(-OBSERVATION_MIN.x01Games);
  const before = x01.slice(-OBSERVATION_MIN.x01Games * 3, -OBSERVATION_MIN.x01Games);
  const a = x01Numbers(recent, me);
  const b = x01Numbers(before, me);
  const through = recent[recent.length - 1].completedAt;
  if (a.avg != null && b.avg != null && Math.abs(a.avg - b.avg) >= OBSERVATION_MIN.avgDelta) {
    const up = a.avg > b.avg;
    return {
      kind: "x01Avg",
      text: `Your X01 average over your last ${recent.length} games is ${a.avg}, ${up ? "up" : "down"} from ${b.avg} in the ${before.length} before.`,
      through,
    };
  }
  if (a.chances >= OBSERVATION_MIN.checkoutChances && b.chances >= OBSERVATION_MIN.checkoutChances && Math.abs(a.pct - b.pct) >= OBSERVATION_MIN.checkoutDelta) {
    const up = a.pct > b.pct;
    return {
      kind: "checkout",
      text: `You've hit ${a.hits} of ${a.chances} checkout darts (${a.pct}%) in your last ${recent.length} games, ${up ? "up" : "down"} from ${b.pct}% (${b.hits} of ${b.chances}) before.`,
      through,
    };
  }
  return null;
}

/**
 * Baseline vs now for a completed plan, only when both sides have enough
 * data. "Now" is play since the plan was created.
 */
export function planComparison(plan, rows, me) {
  const base = plan?.baseline;
  if (!base) return null;
  const start = Date.parse(plan.created_at);
  const since = (rows || []).filter((r) => r.username === me && Date.parse(r.completedAt) >= start);
  const now = x01Numbers(since, me);
  const goal = plan.definition?.goal;
  if ((goal === "finishing" || goal === "x01") && base.checkout?.pct != null && now.chances >= BASELINE_MIN.checkoutChances) {
    return `Checkout darts: ${base.checkout.pct}% before the plan (${base.checkout.chances} chances), ${now.pct}% since you started it (${now.chances} chances).`;
  }
  if (base.x01?.avg != null && now.games >= BASELINE_MIN.x01Games && now.avg != null) {
    return `X01 average: ${base.x01.avg} before the plan (${base.x01.games} games), ${now.avg} since you started it (${now.games} games).`;
  }
  return null;
}

/**
 * The card's content: { state, headline, body, note?, primary, secondary? }.
 * Actions are { kind, label, planId?, session?, item? }; the component maps
 * kinds to navigation. Plan choice: the unfinished plan touched most
 * recently, else the newest.
 *
 * @param {object} o
 * @param {object[]|null|undefined} o.plans  saved plans (undefined while loading, null if not set up)
 * @param {object[]} o.completions           plan_completions rows
 * @param {object|null} o.liveGame           the game in progress on this device
 * @param {object[]} o.rows                  the player's own result rows (practice included)
 * @param {string} o.me
 */
export function merlinState({ plans, completions = [], liveGame = null, rows = [], me }) {
  if (plans === undefined) return { state: "loading", headline: "Checking your training…", body: "" };
  const list = (plans || []).map((p) => ({ plan: p, progress: planProgress(p.definition, completions.filter((c) => c.plan_id === p.id)) }));
  const mine = (rows || []).filter((r) => r.username === me);

  // A/B: a session in progress, on this device or part-completed
  const liveLink = liveGame?.config?.plan;
  const livePlan = liveLink ? list.find((x) => x.plan.id === liveLink.id) : null;
  if (livePlan) {
    const s = livePlan.plan.definition.sessions[liveLink.s];
    const ps = livePlan.progress.sessions[liveLink.s];
    return {
      state: "inProgress",
      headline: "Session In Progress",
      body: `${s?.title || "A session"} in ${livePlan.plan.definition.title}: ${ps ? ps.done : 0} of ${ps ? ps.total : s?.items.length || 0} drills done, and a game is waiting on this device.`,
      primary: { kind: "resume", label: "Continue" },
      secondary: { kind: "viewPlans", label: "View Plan" },
    };
  }
  const unfinished = list.filter((x) => !x.progress.completed);
  const byRecent = (a, b) => String(b.progress.lastActivity || b.plan.created_at).localeCompare(String(a.progress.lastActivity || a.plan.created_at));
  const partial = unfinished.filter((x) => x.progress.inProgressSession != null).sort(byRecent)[0];
  if (partial) {
    const si = partial.progress.inProgressSession;
    const ps = partial.progress.sessions[si];
    const s = partial.plan.definition.sessions[si];
    return {
      state: "inProgress",
      headline: "Session In Progress",
      body: `${s.title} in ${partial.plan.definition.title}: ${ps.done} of ${ps.total} drills done. Pick up where you left off.`,
      primary: { kind: "startPlan", label: "Continue", planId: partial.plan.id, session: si, item: partial.progress.nextItem },
      secondary: { kind: "viewPlans", label: "View Plan" },
    };
  }

  // C: an unfinished plan with a next session
  const next = unfinished.sort(byRecent)[0];
  if (next) {
    const def = next.plan.definition;
    const s = def.sessions[next.progress.nextSession];
    const focus = (s.focus || s.title).replace(/\.$/, "");
    return {
      state: "next",
      headline: "Training Plan Check-In",
      body:
        next.progress.completeSessions === 0
          ? `${def.title} is ready: ${next.progress.totalSessions} sessions. Your first session focuses on ${focus.charAt(0).toLowerCase()}${focus.slice(1)}.`
          : `You have completed ${next.progress.completeSessions} of ${next.progress.totalSessions} sessions in ${def.title}. Your next session focuses on ${focus.charAt(0).toLowerCase()}${focus.slice(1)}.`,
      primary: { kind: "startPlan", label: "Start Next Session", planId: next.plan.id, session: next.progress.nextSession, item: next.progress.nextItem },
      secondary: { kind: "viewPlans", label: "View Plan" },
    };
  }

  // D: every plan finished
  const done = list.filter((x) => x.progress.completed).sort(byRecent)[0];
  if (done) {
    const cmp = planComparison(done.plan, mine, me);
    return {
      state: "completed",
      headline: "Plan Complete",
      body: `You finished every session of ${done.plan.definition.title}${done.progress.lastActivity ? ` on ${fmtDay(done.progress.lastActivity)}` : ""}.${cmp ? ` ${cmp}` : " There isn't enough play since then to compare with your starting numbers yet."}`,
      primary: { kind: "createPlan", label: "Plan What's Next" },
      secondary: { kind: "askAI", label: "Ask Merlin" },
    };
  }

  // E: not enough recorded play to coach from
  if (mine.length < STARTER_MIN_GAMES) {
    const need = STARTER_MIN_GAMES - mine.length;
    return {
      state: "insufficient",
      headline: "Let's Get a Baseline",
      body: `${MERLIN.name} coaches from your recorded games, and there ${mine.length === 1 ? "is" : "are"} ${mine.length} so far. Play ${need} more game${need === 1 ? "" : "s"} or drill${need === 1 ? "" : "s"}, or start the short assessment plan.`,
      primary: { kind: "createPlan", label: "Start an Assessment" },
    };
  }

  // F: something worth saying about recent results
  const obs = recentObservation(mine, me);
  if (obs) {
    return {
      state: "observation",
      headline: "New Results",
      body: obs.text,
      note: `Based on games through ${fmtDay(obs.through)}.`,
      primary: { kind: "createPlan", label: "Build a Plan" },
      secondary: { kind: "askAI", label: "Ask Merlin" },
    };
  }

  return {
    state: "noPlan",
    headline: "What's Next?",
    body: `Build a training plan from your own numbers, or make one yourself. ${MERLIN.name} will track each session as you play it.`,
    primary: { kind: "createPlan", label: "Create a Plan" },
    secondary: { kind: "askAI", label: "Ask Merlin" },
  };
}
