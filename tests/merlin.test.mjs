import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { merlinState, recentObservation, planComparison, MERLIN } from "../lib/merlin.js";
import { validatePlanDefinition } from "../lib/trainingPlans.js";

const def = validatePlanDefinition({
  title: "Doubles Fundamentals",
  goal: "finishing",
  weeks: 3,
  perWeek: 2,
  sessions: [
    { title: "Doubles", focus: "Finishing", items: [{ type: "bobs27", config: {} }, { type: "checkoutDrill", config: { count: 10 } }] },
    { title: "Checkouts", focus: "Finishing under pressure", items: [{ type: "checkoutDrill", config: { count: 20 } }] },
    { title: "Scoring", items: [{ type: "scoringDrill", config: { target: 20, turns: 10 } }] },
    { title: "Doubles 2", items: [{ type: "bobs27", config: {} }] },
    { title: "Checkouts 2", items: [{ type: "checkoutDrill", config: { count: 10 } }] },
    { title: "Review", items: [{ type: "x01", config: { startScore: 501, doubleOut: true } }] },
  ],
}).plan;
const plan = { id: "p1", source: "ai", created_at: "2026-09-01T00:00:00Z", definition: def, baseline: null };
const row = (i, extra = {}) => ({ username: "Ann", gameType: "bobs27", result: "practice", completedAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), stats: {}, ...extra });
const many = Array.from({ length: 8 }, (_, i) => row(i));

test("the name and tagline come from one constant", () => {
  assert.deepEqual(MERLIN, { name: "Merlin", tagline: "Your Blackbird Coach" });
});

test("loading, then no plans with enough history", () => {
  assert.equal(merlinState({ plans: undefined, me: "Ann" }).state, "loading");
  const c = merlinState({ plans: [], rows: many, me: "Ann" });
  assert.equal(c.state, "noPlan");
  assert.equal(c.primary.kind, "createPlan");
});

test("not enough recorded games: says how many more, offers the assessment", () => {
  const c = merlinState({ plans: [], rows: many.slice(0, 2), me: "Ann" });
  assert.equal(c.state, "insufficient");
  assert.match(c.body, /there are 2 so far/);
  assert.match(c.body, /Play 3 more/);
});

test("next session: the counts come from saved progress", () => {
  const completions = [
    { plan_id: "p1", session_idx: 0, item_idx: 0, completed_at: "2026-09-02T10:00:00Z" },
    { plan_id: "p1", session_idx: 0, item_idx: 1, completed_at: "2026-09-02T10:20:00Z" },
    { plan_id: "p1", session_idx: 1, item_idx: 0, completed_at: "2026-09-03T10:00:00Z" },
  ];
  const c = merlinState({ plans: [plan], completions, rows: many, me: "Ann" });
  assert.equal(c.state, "next");
  assert.equal(c.headline, "Training Plan Check-In");
  assert.equal(c.body, "You have completed 2 of 6 sessions in Doubles Fundamentals. Your next session focuses on scoring.");
  assert.deepEqual([c.primary.kind, c.primary.session, c.secondary.label], ["startPlan", 2, "View Plan"]);
});

test("a part-done session or a game waiting on this device comes first, with Continue", () => {
  const partial = merlinState({ plans: [plan], completions: [{ plan_id: "p1", session_idx: 0, item_idx: 0 }], rows: many, me: "Ann" });
  assert.equal(partial.state, "inProgress");
  assert.equal(partial.primary.label, "Continue");
  assert.equal(partial.primary.item, 1);
  const live = merlinState({ plans: [plan], completions: [], liveGame: { gameType: "bobs27", config: { plan: { id: "p1", s: 0, i: 0 } } }, rows: many, me: "Ann" });
  assert.equal(live.state, "inProgress");
  assert.equal(live.primary.kind, "resume");
});

test("a completed plan is acknowledged without claiming the plan caused any change", () => {
  const all = def.sessions.flatMap((s, si) => s.items.map((_, ii) => ({ plan_id: "p1", session_idx: si, item_idx: ii, completed_at: "2026-09-20T10:00:00Z" })));
  const c = merlinState({ plans: [plan], completions: all, rows: many, me: "Ann" });
  assert.equal(c.state, "completed");
  assert.match(c.body, /You finished every session of Doubles Fundamentals on Sep 20/);
  assert.match(c.body, /isn't enough play since then to compare/);
  assert.doesNotMatch(c.body, /because|thanks to|improved due/i);
});

test("baseline comparison only with enough data on both sides", () => {
  const withBase = { ...plan, baseline: { x01: { avg: 40, games: 6 }, checkout: { pct: null, chances: 4 } } };
  const x01 = (i, pts) => ({ username: "Ann", gameType: "x01", result: "practice", completedAt: new Date(Date.UTC(2026, 8, 2 + i)).toISOString(), config: { startScore: 501, doubleOut: true }, stats: { dartsThrown: 30, pointsScored: pts } });
  assert.equal(planComparison(withBase, [x01(0, 450)], "Ann"), null, "one game since isn't enough");
  const cmp = planComparison(withBase, [x01(0, 450), x01(1, 480), x01(2, 500)], "Ann");
  assert.match(cmp, /X01 average: 40 before the plan \(6 games\), 47\.7 since you started it \(3 games\)/);
});

test("observations need real samples and a real change, and say when they're from", () => {
  const x01 = (i, pts) => ({ username: "Ann", gameType: "x01", result: "practice", completedAt: new Date(Date.UTC(2026, 7, 1 + i)).toISOString(), config: { startScore: 501, doubleOut: true }, stats: { dartsThrown: 30, pointsScored: pts } });
  const flat = Array.from({ length: 15 }, (_, i) => x01(i, 400));
  assert.equal(recentObservation(flat, "Ann"), null, "no change, nothing to say");
  const up = [...Array.from({ length: 10 }, (_, i) => x01(i, 400)), ...Array.from({ length: 5 }, (_, i) => x01(10 + i, 500))];
  const o = recentObservation(up, "Ann");
  assert.match(o.text, /last 5 games is 50, up from 40 in the 10 before/);
  const c = merlinState({ plans: [], rows: up, me: "Ann" });
  assert.equal(c.state, "observation");
  assert.match(c.note, /Based on games through Aug 14/);
  // a correction (deleting the newer games) removes the claim: nothing is cached
  assert.equal(merlinState({ plans: [], rows: up.slice(0, 10), me: "Ann" }).state, "noPlan");
});

test("the card never calls AI: no fetch or model import in lib/merlin.js", () => {
  const src = readFileSync(new URL("../lib/merlin.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|aiProviders|aiServer|\/api\//);
  // and rendering it many times makes no network calls
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("no network in Merlin");
  };
  try {
    for (let i = 0; i < 50; i++) merlinState({ plans: [plan], completions: [], rows: many, me: "Ann" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
