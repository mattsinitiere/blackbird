import { test } from "node:test";
import assert from "node:assert/strict";
import { capHistory, serializeLive, parseLive, needsReplaceConfirm, liveSummary, LIVE_UNDO_STEPS } from "../lib/liveGame.js";

const game = { id: "g1", gameType: "x01", config: { startScore: 301, doubleOut: true, legs: 1 }, players: ["Chuck", "Matthew"] };
const step = (i) => ({ s: { scores: { Chuck: 301 - i, Matthew: 301 }, log: Array.from({ length: i }, () => ({ n: 20, mult: 1 })) }, turn: i });
const progress = (n) => ({ s: { scores: { Chuck: 161, Matthew: 130 } }, turn: n, turnDarts: [], history: Array.from({ length: n }, (_, i) => step(i)) });

test("undo history survives a reload, capped to the most recent steps", () => {
  const raw = serializeLive({ userId: "u1", game, progress: progress(25) });
  const back = parseLive(raw, "u1");
  assert.equal(back.game.id, "g1");
  assert.equal(back.progress.history.length, LIVE_UNDO_STEPS);
  // the newest steps are the ones kept
  assert.equal(back.progress.history.at(-1).turn, 24);
  assert.equal(back.progress.history[0].turn, 25 - LIVE_UNDO_STEPS);
  // short histories are kept whole
  assert.equal(parseLive(serializeLive({ userId: "u1", game, progress: progress(3) }), "u1").progress.history.length, 3);
  assert.equal(capHistory(null), null);
  assert.deepEqual(capHistory({ turn: 1 }), { turn: 1 });
});

test("a save that would be too big keeps fewer undo steps, then none", () => {
  const p = progress(10);
  const full = serializeLive({ userId: "u", game, progress: p });
  const smaller = serializeLive({ userId: "u", game, progress: p }, { maxChars: Math.floor(full.length * 0.7) });
  const kept = JSON.parse(smaller).progress.history.length;
  assert.ok(kept > 0 && kept < 10, `kept ${kept}`);
  const tiny = JSON.parse(serializeLive({ userId: "u", game, progress: p }, { maxChars: 10 }));
  assert.deepEqual(tiny.progress.history, []);
  assert.deepEqual(tiny.progress.s.scores, { Chuck: 161, Matthew: 130 }); // the game itself is never dropped
});

test("a saved game only restores for the account that played it", () => {
  const raw = serializeLive({ userId: "u1", game, progress: progress(1) });
  assert.equal(parseLive(raw, "u2"), null);
  assert.equal(parseLive(raw, null), null);
  assert.equal(parseLive("{broken", "u1"), null);
  assert.equal(parseLive(JSON.stringify({ userId: "u1", game: { players: [] } }), "u1"), null);
});

test("starting another game while one is live asks first; resuming does not", () => {
  assert.equal(needsReplaceConfirm(null, game), false);
  assert.equal(needsReplaceConfirm(game, { ...game }), false);
  assert.equal(needsReplaceConfirm(game, { ...game, id: "g2" }), true);
  assert.equal(needsReplaceConfirm(game, { ...game, id: "" }), true);
});

test("the in-progress card names the game, the players and their scores", () => {
  const s = liveSummary(game, progress(2));
  assert.equal(s.title, "301 · double out");
  assert.equal(s.label, "301 · double out · Chuck vs Matthew");
  assert.deepEqual(s.players.map((p) => [p.name, p.score]), [["Chuck", 161], ["Matthew", 130]]);
  const bot = liveSummary({ gameType: "baseball", config: {}, players: ["Chuck", "bot:raven"] }, { state: { Chuck: { total: 4 }, "bot:raven": { total: 2 } } });
  assert.deepEqual(bot.players.map((p) => [p.name, p.score]), [["Chuck", 4], ["Raven", 2]]);
  const noScores = liveSummary({ gameType: "killer", config: { lives: 3 }, players: ["A", "B"] }, null);
  assert.deepEqual(noScores.players.map((p) => p.score), [null, null]);
  assert.equal(liveSummary({ gameType: "bobs27", config: {}, players: ["A"] }, null).label, "Bob's 27");
});
