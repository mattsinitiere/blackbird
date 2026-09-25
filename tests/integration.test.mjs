import { test } from "node:test";
import assert from "node:assert/strict";
import { createRecorder, recordVisit, finishRecorder } from "../lib/recorder.js";
import { isRankedMatch, buildResultRows, botLadder } from "../lib/practice.js";
import { playerLabel, isBot } from "../lib/bots.js";
import { ALTER_EGO_ID, botFromConfig, frozenConfig } from "../lib/alterEgo.js";
import { doubleRates } from "../lib/strategy/evidence.js";
import { hintPrefs } from "../lib/strategy/prefs.js";

test("the recorder keeps a drill's intended target and never invents one", () => {
  const rec = createRecorder({ players: ["Ann"], startedAt: "2026-09-01T10:00:00Z" });
  recordVisit(rec, "Ann", { r: 0, s0: 27, darts: [{ n: 1, mult: 2, a: { n: 1, mult: 2 } }, { n: 0, mult: 0, a: { n: 1, mult: 2 } }, { n: 20, mult: 1 }], out: {} });
  const v = finishRecorder(rec, "Ann", "2026-09-01T10:05:00Z").visits[0];
  assert.deepEqual(v.darts[0].a, { n: 1, mult: 2 });
  assert.deepEqual(v.darts[1].a, { n: 1, mult: 2 });
  assert.equal(v.darts[2].a, undefined, "no aim recorded, none inferred");
});

test("X01 darts without a recorded aim add no target attempts", () => {
  const rows = [{ username: "Ann", gameType: "x01", stats: { visits: [{ r: 0, s0: 40, darts: [{ n: 20, mult: 2 }, { n: 20, mult: 1 }] }] } }];
  const r = doubleRates(rows, { me: "Ann" });
  assert.equal(r.byDouble.D20.attempts, 0);
  assert.ok(r.unknownDarts >= 2);
});

test("Alter Ego games are practice: never ranked, no Elo, labelled, off the ladder", () => {
  assert.equal(isBot(ALTER_EGO_ID), true);
  assert.equal(playerLabel(ALTER_EGO_ID), "Alter Ego");
  assert.equal(isRankedMatch({ gameType: "x01", players: ["Ann", ALTER_EGO_ID] }), false);
  const rows = buildResultRows({ gameId: "g1", gameType: "x01", config: {}, players: ["Ann", ALTER_EGO_ID], winner: "Ann", perPlayer: { Ann: {} }, ranked: false, currentElo: { Ann: 1010 }, completedAt: "2026-09-01T10:00:00Z", baseElo: 1000 });
  assert.equal(rows.length, 1, "no row for the bot");
  assert.equal(rows[0].result, "practice");
  assert.equal(rows[0].elo_after, 1010, "Elo unchanged");
  const ladder = botLadder([{ username: "Ann", opponents: [ALTER_EGO_ID], winner: "Ann" }], "Ann");
  assert.ok(ladder.every((l) => l.wins === 0), "beating Alter Ego unlocks nothing");
});

test("a frozen Alter Ego config rebuilds the same bot on resume (JSON round trip)", () => {
  const profile = { ok: true, version: 1, window: "last10", from: "2026-08-01T00:00:00Z", to: "2026-09-01T00:00:00Z", games: 10, scoringDarts: 400, scoringAvg: 55.2, checkoutChances: 30, checkoutHits: 7, checkoutDartRate: 0.233, sigmaScoring: 17.4, sigmaFinish: 12.9 };
  const cfg = frozenConfig(profile);
  const resumed = JSON.parse(JSON.stringify({ config: { alterEgo: cfg } }));
  assert.deepEqual(botFromConfig(resumed.config.alterEgo), botFromConfig(cfg));
  assert.equal(botFromConfig(cfg).id, ALTER_EGO_ID);
});

test("hint preferences default to Standard with no preferred double", () => {
  assert.deepEqual(hintPrefs({}), { mode: "standard", preferredDouble: null });
  assert.deepEqual(hintPrefs({ hints: "off", preferredDouble: "D16" }), { mode: "off", preferredDouble: "D16" });
  assert.deepEqual(hintPrefs({ hints: "deep", preferredDouble: "D99" }), { mode: "standard", preferredDouble: null });
});
