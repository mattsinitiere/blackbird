import { test } from "node:test";
import assert from "node:assert/strict";
import { pickX01Target, pickCricketTarget, pickBaseballTarget, botThrow } from "../lib/botStrategy.js";
import { parseCheckout } from "../lib/checkouts.js";
import { botLadder } from "../lib/practice.js";
import { BOTS, botFor, playerLabel, botColors } from "../lib/bots.js";
import { mulberry32 } from "../lib/simulator.js";

test("parseCheckout turns chart strings into darts", () => {
  assert.deepEqual(parseCheckout("T20 T20 Bull"), [{ n: 20, mult: 3 }, { n: 20, mult: 3 }, { n: 25, mult: 2 }]);
  assert.deepEqual(parseCheckout("S1 D2"), [{ n: 1, mult: 1 }, { n: 2, mult: 2 }]);
  assert.deepEqual(parseCheckout("T19 25 D16"), [{ n: 19, mult: 3 }, { n: 25, mult: 1 }, { n: 16, mult: 2 }]);
  assert.deepEqual(parseCheckout(null), []);
});

test("x01 double-out: chart when a finish is on, T20 otherwise", () => {
  const always = () => 0; // rng below checkout: always knows the out
  assert.deepEqual(pickX01Target({ remaining: 501, checkout: 1 }, always), { n: 20, mult: 3 });
  assert.deepEqual(pickX01Target({ remaining: 169, checkout: 1 }, always), { n: 20, mult: 3 }); // bogey
  assert.deepEqual(pickX01Target({ remaining: 170, checkout: 1 }, always), { n: 20, mult: 3 });
  assert.deepEqual(pickX01Target({ remaining: 32, checkout: 1 }, always), { n: 16, mult: 2 });
  assert.deepEqual(pickX01Target({ remaining: 50, checkout: 1 }, always), { n: 25, mult: 2 });
  assert.deepEqual(pickX01Target({ remaining: 2, checkout: 1 }, always), { n: 1, mult: 2 });
  assert.deepEqual(pickX01Target({ remaining: 121, checkout: 1 }, always), parseCheckout("T20 T11 D14")[0]);
});

test("x01 double-out: a bot that doesn't know the out just scores, but never above 40", () => {
  const never = () => 0.99; // rng above checkout: doesn't know the out
  assert.deepEqual(pickX01Target({ remaining: 121, checkout: 0.2 }, never), { n: 20, mult: 3 });
  assert.deepEqual(pickX01Target({ remaining: 81, checkout: 0.2 }, never), { n: 20, mult: 1 });
  assert.deepEqual(pickX01Target({ remaining: 40, checkout: 0.2 }, never), { n: 20, mult: 2 });
  assert.deepEqual(pickX01Target({ remaining: 36, checkout: 0 }, never), { n: 18, mult: 2 });
});

test("x01 straight-in: score, then take the single-dart finish", () => {
  const p = (remaining) => pickX01Target({ remaining, doubleOut: false });
  assert.deepEqual(p(301), { n: 20, mult: 3 });
  assert.deepEqual(p(60), { n: 20, mult: 3 });
  assert.deepEqual(p(50), { n: 25, mult: 2 });
  assert.deepEqual(p(40), { n: 20, mult: 2 });
  assert.deepEqual(p(21), { n: 7, mult: 3 });
  assert.deepEqual(p(17), { n: 17, mult: 1 });
  assert.deepEqual(p(59), { n: 20, mult: 1 }); // leave 39
});

test("cricket: close highest open number, then score on what opponents have open", () => {
  const closed = { 20: 3, 19: 3, 18: 3, 17: 3, 16: 3, 15: 3, B: 3 };
  assert.deepEqual(pickCricketTarget({ marks: { ...closed, 19: 1 } }), { n: 19, mult: 3 });
  assert.deepEqual(pickCricketTarget({ marks: { ...closed, B: 0 } }), { n: 25, mult: 2 });
  assert.deepEqual(pickCricketTarget({ marks: closed, others: [{ ...closed, 18: 2 }] }), { n: 18, mult: 3 });
  assert.deepEqual(pickCricketTarget({ variant: "cutthroat", marks: closed, others: [{ ...closed, 15: 0 }] }), { n: 15, mult: 3 });
  assert.equal(pickCricketTarget({ variant: "noscore", marks: closed, others: [{ ...closed, 15: 0 }] }), null);
  assert.equal(pickCricketTarget({ marks: closed, others: [closed] }), null);
  assert.deepEqual(pickBaseballTarget(7), { n: 7, mult: 3 });
});

test("botThrow uses the bot's accuracy: the top bot hits T20 far more often than the bottom one", () => {
  const rate = (bot) => {
    const rng = mulberry32(5);
    let hit = 0;
    for (let i = 0; i < 4000; i++) {
      const d = botThrow(bot, { n: 20, mult: 3 }, rng);
      if (d.n === 20 && d.mult === 3) hit++;
    }
    return hit / 4000;
  };
  assert.ok(rate(BOTS[7]) > 0.25, "top bot hits T20 over a quarter of the time");
  assert.ok(rate(BOTS[0]) < 0.03, "bottom bot almost never hits T20");
});

test("roster helpers", () => {
  assert.equal(BOTS.length, 8);
  assert.equal(botFor("bot:rook").name, "Rook");
  assert.equal(botFor("Matt"), null);
  assert.equal(playerLabel("bot:blackbird"), "Blackbird");
  assert.equal(botColors()["bot:jay"], BOTS[2].color);
});

test("botLadder: records per bot and unlock by beating the one below", () => {
  const me = "Matt";
  const row = (opp, winner) => ({ username: me, result: "practice", opponents: [opp], winner });
  const empty = botLadder([], me);
  assert.equal(empty[0].unlocked, true);
  assert.equal(empty[1].unlocked, false);
  const rows = [row("bot:rook", "bot:rook"), row("bot:rook", me), row("bot:sparrow", "bot:sparrow"), { username: "Sam", result: "practice", opponents: ["bot:sparrow"], winner: "Sam" }];
  const l = botLadder(rows, me);
  assert.deepEqual([l[0].wins, l[0].losses, l[0].unlocked], [1, 1, true]);
  assert.deepEqual([l[1].wins, l[1].losses, l[1].unlocked], [0, 1, true]);
  assert.equal(l[2].unlocked, false, "Sam's win over Sparrow doesn't unlock Jay for Matt");
});
