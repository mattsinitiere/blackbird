import { test } from "node:test";
import assert from "node:assert/strict";
import { applyKillerDart, previewKillerVisit } from "../lib/killer.js";
import { pickKillerTarget, botThrow } from "../lib/botStrategy.js";
import { BOTS, BOT_GAMES } from "../lib/bots.js";
import { isRankedMatch } from "../lib/practice.js";
import { mulberry32 } from "../lib/simulator.js";

const players = ["Ann", "bot:jay", "Cat"];
const numbers = { Ann: 5, "bot:jay": 12, Cat: 18 };
const ctx = { players, numbers };
const fresh = (lives = 3) => ({
  lives: Object.fromEntries(players.map((u) => [u, lives])),
  killer: Object.fromEntries(players.map((u) => [u, false])),
});
const D = (n) => ({ n, mult: 2 });

test("killer rules: only doubles count, and only a killer can take lives", () => {
  const s = fresh();
  assert.deepEqual(applyKillerDart(s, "Ann", { n: 5, mult: 1 }, ctx), []);
  assert.deepEqual(applyKillerDart(s, "Ann", { n: 5, mult: 3 }, ctx), []);
  assert.deepEqual(applyKillerDart(s, "Ann", { n: 0, mult: 0 }, ctx), []);
  assert.deepEqual(applyKillerDart(s, "Ann", D(12), ctx), [], "not a killer yet: an opponent's double does nothing");
  assert.equal(s.lives["bot:jay"], 3);
  assert.deepEqual(applyKillerDart(s, "Ann", D(5), ctx), [{ t: "killer", by: "Ann" }]);
  assert.equal(s.killer.Ann, true);
  assert.deepEqual(applyKillerDart(s, "Ann", D(12), ctx), [{ t: "hit", by: "Ann", on: "bot:jay" }]);
  assert.equal(s.lives["bot:jay"], 2);
  assert.deepEqual(applyKillerDart(s, "Ann", D(7), ctx), [], "nobody's number");
});

test("killer rules: a killer's own double costs a life, and the last life eliminates", () => {
  const s = fresh(1);
  s.killer.Ann = true;
  assert.deepEqual(applyKillerDart(s, "Ann", D(18), ctx), [
    { t: "hit", by: "Ann", on: "Cat" },
    { t: "elim", by: "Ann", on: "Cat" },
  ]);
  assert.deepEqual(applyKillerDart(s, "Ann", D(18), ctx), [], "an eliminated player cannot be hit again");
  assert.deepEqual(applyKillerDart(s, "Ann", D(5), ctx), [
    { t: "self", by: "Ann" },
    { t: "elim", by: "Ann", on: "Ann" },
  ]);
  assert.deepEqual(applyKillerDart(s, "Ann", D(12), ctx), [], "out of lives: the rest of the visit is dead");
  assert.equal(s.lives["bot:jay"], 1);
});

test("previewKillerVisit applies the visit so far without touching the stored state", () => {
  const s = fresh();
  const live = previewKillerVisit(s, "Ann", [D(5), D(12)], ctx);
  assert.equal(live.killer.Ann, true);
  assert.equal(live.lives["bot:jay"], 2);
  assert.equal(s.killer.Ann, false);
  assert.equal(s.lives["bot:jay"], 3);
});

test("killer bot: own double first, then the weakest living opponent", () => {
  const s = fresh();
  const pick = (st) => pickKillerTarget({ me: "bot:jay", players, numbers, lives: st.lives, killer: st.killer });
  assert.deepEqual(pick(s), { n: 12, mult: 2 });
  s.killer["bot:jay"] = true;
  assert.deepEqual(pick(s), { n: 5, mult: 2 }, "level on lives: first in the throw order");
  s.lives.Cat = 1;
  assert.deepEqual(pick(s), { n: 18, mult: 2 });
  s.lives.Cat = 0;
  assert.deepEqual(pick(s), { n: 5, mult: 2 }, "the eliminated are skipped");
  s.lives.Ann = 0;
  assert.equal(pick(s), null, "nobody left to hit");
  const out = fresh();
  out.lives["bot:jay"] = 0;
  assert.equal(pick(out), null, "a bot that is out throws nothing");
});

test("killer is a bot game, and a bot game is always practice", () => {
  assert.ok(BOT_GAMES.has("killer"));
  assert.equal(isRankedMatch({ gameType: "killer", players: ["Ann", "bot:jay"] }), false);
  assert.equal(isRankedMatch({ gameType: "killer", players: ["Ann", "Cat"] }), true);
});

// two bots play each other through the same rules the scorer uses; seats
// are "a" and "b" so a bot can play a mirror match against itself
function playOut(a, b, rng, lives = 3) {
  const ps = ["a", "b"];
  const nums = { a: 7, b: 16 };
  const by = { a, b };
  const s = { lives: { a: lives, b: lives }, killer: { a: false, b: false } };
  for (let turn = 0; turn < 20000; turn++) {
    const cur = ps[turn % 2];
    for (let d = 0; d < 3; d++) {
      const target = pickKillerTarget({ me: cur, players: ps, numbers: nums, lives: s.lives, killer: s.killer });
      if (!target) break;
      applyKillerDart(s, cur, botThrow(by[cur], target, rng), { players: ps, numbers: nums });
    }
    const alive = ps.filter((u) => s.lives[u] > 0);
    if (alive.length <= 1) return { winner: by[alive[0] || cur], turns: turn + 1 };
  }
  return { winner: null, turns: Infinity };
}

test("killer bot: every bot finishes a game, and the top bot beats the bottom one", () => {
  const rng = mulberry32(7);
  const rook = BOTS[0];
  const top = BOTS[BOTS.length - 1];
  for (const bot of BOTS) assert.ok(playOut(bot, bot, rng).winner, `${bot.name} finishes a mirror match`);
  let topWins = 0;
  for (let i = 0; i < 40; i++) if (playOut(i % 2 ? rook : top, i % 2 ? top : rook, rng).winner === top) topWins++;
  assert.ok(topWins >= 38, `Blackbird should beat Rook nearly every time (won ${topWins}/40)`);
});
