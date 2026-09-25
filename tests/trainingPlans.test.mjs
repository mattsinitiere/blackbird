import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlanDefinition, validateItem, starterPlan, planProgress, planBaseline, needsStarter, launchSpec, itemLabel, sessionMinutes, MAX_PLANS, LIMIT_MESSAGE } from "../lib/trainingPlans.js";
import { parsePlanJSON } from "../lib/planPrompt.js";
import { planGame, unplayableItems } from "../lib/planLaunch.js";

const custom = {
  title: "Doubles Fundamentals",
  goal: "finishing",
  weeks: 2,
  perWeek: 2,
  sessions: [
    { title: "Doubles", items: [{ type: "bobs27", config: {} }, { type: "checkoutDrill", config: { count: 10 } }] },
    { title: "Finishing", items: [{ type: "checkoutDrill", config: { count: 20 } }] },
    { title: "Scoring", items: [{ type: "scoringDrill", config: { target: "bull", turns: 10 } }, { type: "x01", config: { startScore: 501 } }] },
  ],
};

test("a builder plan with supported drills validates and gets computed labels and minutes", () => {
  const v = validatePlanDefinition(custom);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.plan.schemaVersion, 1);
  assert.equal(v.plan.sessions[2].items[0].config.target, 25);
  assert.equal(v.plan.sessions[2].items[1].config.doubleOut, true);
  assert.equal(v.plan.sessions[0].items[1].label, "Checkout Drill · 10 finishes");
  assert.equal(v.plan.sessions[0].minutes, 12 + 14);
});

test("a Merlin-style plan is held to the same allowlist: invented modes and settings are rejected, not snapped", () => {
  const bad = structuredClone(custom);
  bad.sessions[0].items[0] = { type: "cricketDrill", config: {} };
  bad.sessions[1].items[0] = { type: "checkoutDrill", config: { count: 12 } };
  bad.sessions[2].items.push({ type: "x01", config: { startScore: 501, doubleIn: true } });
  const v = validatePlanDefinition(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /unknown type "cricketDrill"/.test(e)));
  assert.ok(v.errors.some((e) => /count must be one of 5, 10, 20/.test(e)));
  assert.ok(v.errors.some((e) => /unsupported settings doubleIn/.test(e)));
  assert.equal(validateItem({ type: "bot", config: { bot: "bot:nobody", gameType: "x01" } }).error.includes("bot must be one of"), true);
});

test("plan size is bounded: sessions, items per session, weeks × perWeek", () => {
  assert.equal(validatePlanDefinition({ ...custom, weeks: 1, perWeek: 2 }).ok, false, "3 sessions don't fit 1 × 2");
  const many = { ...custom, weeks: 6, perWeek: 5, sessions: Array.from({ length: 25 }, () => custom.sessions[1]) };
  assert.equal(validatePlanDefinition(many).ok, false);
  const fat = structuredClone(custom);
  fat.sessions[0].items = Array.from({ length: 5 }, () => ({ type: "bobs27", config: {} }));
  assert.equal(validatePlanDefinition(fat).ok, false);
});

test("the starter assessment is valid, labelled, and uses only real drills", () => {
  const p = starterPlan();
  assert.equal(p.starter, true);
  assert.equal(p.goal, "assessment");
  assert.match(p.why, /isn't enough recorded play/);
  assert.equal(validatePlanDefinition(p).ok, true);
  assert.equal(needsStarter({ games: 2 }), true);
  assert.equal(needsStarter({ games: 40 }), false);
});

test("progress: sessions complete only when every item has a saved game; duplicate rows count once", () => {
  const def = validatePlanDefinition(custom).plan;
  let pr = planProgress(def, []);
  assert.equal(pr.completeSessions, 0);
  assert.equal(pr.nextSession, 0);
  assert.equal(pr.inProgressSession, null);
  const rows = [{ session_idx: 0, item_idx: 0, completed_at: "2026-09-01T10:00:00Z" }];
  pr = planProgress(def, [...rows, ...rows]); // a replayed sync
  assert.equal(pr.sessions[0].done, 1);
  assert.equal(pr.inProgressSession, 0);
  assert.equal(pr.nextItem, 1);
  pr = planProgress(def, [...rows, { session_idx: 0, item_idx: 1 }, { session_idx: 1, item_idx: 0 }, { session_idx: 2, item_idx: 0 }, { session_idx: 2, item_idx: 1 }]);
  assert.equal(pr.completed, true);
  assert.equal(pr.pct, 100);
  assert.equal(pr.nextSession, null);
});

test("launching an item runs the existing game with the saved settings and a plan link", () => {
  const def = validatePlanDefinition(custom).plan;
  const spec = launchSpec("plan-1", 0, 1, def.sessions[0].items[1], 2);
  assert.deepEqual(spec, { gameType: "checkoutDrill", config: { count: 10, plan: { id: "plan-1", s: 0, i: 1, n: 2 } } });
  const g = planGame({ planId: "plan-1", session: 2, item: 1, total: 2, planItem: def.sessions[2].items[1], me: "Ann", rows: [] });
  assert.equal(g.game.gameType, "x01");
  assert.deepEqual(g.game.players, ["Ann"]);
  assert.equal(g.game.config.startScore, 501);
  assert.equal(g.game.config.plan.id, "plan-1");
});

test("locked bots and Alter Ego without history are reported as unplayable (so they can't be saved)", () => {
  const plan = validatePlanDefinition({
    title: "Bots",
    goal: "x01",
    weeks: 1,
    perWeek: 2,
    sessions: [{ title: "A", items: [{ type: "bot", config: { bot: "bot:raven", gameType: "x01" } }] }, { title: "B", items: [{ type: "alterEgo", config: { window: "last10" } }] }],
  }).plan;
  const blocked = unplayableItems(plan, { rows: [], me: "Ann" });
  assert.equal(blocked.length, 2);
  assert.match(blocked[0].reason, /Raven isn't unlocked/);
  assert.equal(itemLabel(plan.sessions[0].items[0]), "Raven · X01");
  assert.ok(sessionMinutes(plan.sessions[0]) > 0);
});

test("the model's reply is parsed from a fence or bare JSON, and junk is null", () => {
  assert.equal(parsePlanJSON('Here:\n```json\n{"title":"A","sessions":[]}\n```').title, "A");
  assert.equal(parsePlanJSON('{"plan": {"title": "B"}}').title, "B");
  assert.equal(parsePlanJSON("no plan here"), null);
});

test("baseline numbers carry sample sizes and stay null below the minimum", () => {
  const rows = [
    { username: "Ann", gameType: "bobs27", result: "practice", completedAt: "2026-09-01T10:00:00Z", stats: { finalScore: 40 } },
    { username: "Ann", gameType: "bobs27", result: "practice", completedAt: "2026-09-02T10:00:00Z", stats: { finalScore: 60 } },
    { username: "Ann", gameType: "checkoutDrill", result: "practice", completedAt: "2026-09-03T10:00:00Z", stats: { finishes: 10, hit: 3 } },
    { username: "Bob", gameType: "bobs27", result: "practice", completedAt: "2026-09-03T10:00:00Z", stats: { finalScore: 999 } },
  ];
  const b = planBaseline(rows, "Ann");
  assert.equal(b.bobs27.avg, 50);
  assert.equal(b.bobs27.games, 2);
  assert.equal(b.checkoutDrill.hitPct, null, "one session is below the minimum");
  assert.equal(b.x01.avg, null);
  assert.equal(b.games, 3);
});

test("the limit and its message are fixed", () => {
  assert.equal(MAX_PLANS, 3);
  assert.equal(LIMIT_MESSAGE, "You have reached your limit of 3 training plans. Delete a plan to create another.");
});
