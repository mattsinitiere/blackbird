import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummary, gameTitle } from "../lib/summary.js";

const x01Match = {
  gameType: "x01",
  config: { startScore: 501, doubleOut: true, legs: 1 },
  players: ["Ann", "Bob"],
  winner: "Bob",
  completedAt: "2026-09-18T20:12:00.000Z",
  perPlayer: {
    Ann: { dartsThrown: 21, pointsScored: 420, highestTurn: 100, checkout: 0 },
    Bob: { dartsThrown: 18, pointsScored: 501, highestTurn: 140, checkout: 64 },
  },
};

test("gameTitle describes rules", () => {
  assert.equal(gameTitle("x01", { startScore: 301, doubleOut: false, legs: 3 }), "301 · straight out · best of 3");
  assert.equal(gameTitle("cricket", { variant: "cutthroat" }), "Cricket · Cutthroat");
  assert.equal(gameTitle("baseball"), "Baseball");
});

test("x01 summary ranks winner first with avg, checkout and elo deltas", () => {
  const s = buildSummary({
    match: x01Match,
    game: { startedAt: "2026-09-18T20:00:00.000Z" },
    eloBefore: { Ann: 1000, Bob: 1000 },
    eloAfter: { Ann: 988, Bob: 1012 },
    colors: { Ann: "#111111" },
  });
  assert.equal(s.title, "501 · double out");
  assert.equal(s.winner, "Bob");
  assert.equal(s.ranked, true);
  assert.equal(s.durationMin, 12);
  assert.equal(s.totalDarts, 39);
  assert.deepEqual(s.rows.map((r) => r.u), ["Bob", "Ann"]);
  assert.equal(s.rows[0].rank, 1);
  assert.equal(s.rows[0].primary.value, "83.5");
  assert.equal(s.rows[0].primary.label, "3-dart avg");
  assert.ok(!s.rows[0].stats.some((st) => st.label === "3-dart avg"));
  assert.deepEqual(s.rows[0].elo, { before: 1000, after: 1012, delta: 12 });
  assert.deepEqual(s.rows[1].elo, { before: 1000, after: 988, delta: -12 });
  assert.equal(s.rows[1].color, "#111111");
  assert.ok(s.rows[0].stats.some((st) => st.label === "checkout" && st.value === 64));
  assert.ok(!s.rows[1].stats.some((st) => st.label === "checkout"));
  assert.deepEqual(
    s.highlights.map((h) => [h.label, h.player]),
    [["Highest turn", "Bob"], ["Checkout", "Bob"], ["Best average", "Bob"]]
  );
});

test("practice game has no elo and is not ranked", () => {
  const s = buildSummary({ match: { ...x01Match, players: ["Ann"], winner: "Ann" }, eloBefore: null, eloAfter: null });
  assert.equal(s.ranked, false);
  assert.equal(s.rows.length, 1);
  assert.equal(s.rows[0].elo, null);
  assert.equal(s.durationMin, null);
});

test("cutthroat cricket ranks the non-winners by fewest points", () => {
  const s = buildSummary({
    match: {
      gameType: "cricket",
      config: { variant: "cutthroat" },
      players: ["A", "B", "C"],
      winner: "A",
      perPlayer: {
        A: { marks: 30, rounds: 10, mpr: 3, pointsScored: 10, darts: [] },
        B: { marks: 20, rounds: 10, mpr: 2, pointsScored: 90, darts: [] },
        C: { marks: 25, rounds: 10, mpr: 2.5, pointsScored: 40, darts: [] },
      },
    },
  });
  assert.deepEqual(s.rows.map((r) => r.u), ["A", "C", "B"]);
  assert.equal(s.rows[0].primary.label, "points");
  assert.equal(s.highlights[0].label, "Best MPR");
  assert.equal(s.highlights[0].player, "A");
});

test("x01 with legs uses legs as the primary number", () => {
  const s = buildSummary({
    match: {
      ...x01Match,
      config: { startScore: 501, doubleOut: true, legs: 3 },
      perPlayer: {
        Ann: { ...x01Match.perPlayer.Ann, legsWon: 1 },
        Bob: { ...x01Match.perPlayer.Bob, legsWon: 2 },
      },
    },
  });
  assert.equal(s.rows[0].primary.label, "legs");
  assert.equal(s.rows[0].primary.value, 2);
});

test("every game type produces a row with a primary value", () => {
  const cases = {
    baseball: { runs: 7, darts: [1, 2, 3] },
    aroundTheClock: { dartsThrown: 30, targetsHit: 21 },
    killer: { dartsThrown: 12, livesRemaining: 2, isKiller: true },
    shanghai: { totalScore: 88, roundScores: [10, 30, 48], dartsThrown: 21, shanghai: false },
    halveit: { finalScore: 120, halves: 1, dartsThrown: 27 },
    gotcha: { finalScore: 301, resetsDealt: 1, resetsReceived: 0, dartsThrown: 24 },
    tictactoe: { squaresClaimed: 3, dartsThrown: 9 },
    bobs27: { finalScore: 61, doublesHit: 9, roundsCompleted: 21, busted: false, dartsThrown: 63 },
    checkoutDrill: { finishes: 10, hit: 4, dartsPerHit: 5.5, highestCheckout: 121, dartsThrown: 78 },
    scoringDrill: { total: 410, turns: 10, avgPerTurn: 41, trebles: 3, hitRate: 70, bestVisit: 100, dartsThrown: 30 },
  };
  for (const [gameType, pp] of Object.entries(cases)) {
    const s = buildSummary({ match: { gameType, config: {}, players: ["A", "B"], winner: "A", perPlayer: { A: pp, B: pp } } });
    assert.equal(s.rows[0].u, "A", gameType);
    assert.notEqual(s.rows[0].primary.value, "", gameType);
    assert.ok(s.rows[0].stats.length >= 1, gameType);
  }
});

test("drill summaries: titles, ranking and highlights", () => {
  assert.equal(gameTitle("checkoutDrill", { count: 20 }), "Checkout Drill · 20 finishes");
  assert.equal(gameTitle("scoringDrill", { target: 25, turns: 5 }), "Scoring Drill · Bull · 5 visits");
  assert.equal(gameTitle("bobs27"), "Bob's 27");

  // a busted Bob's 27 player ranks below anyone still standing, whatever the score
  const bobs = buildSummary({
    match: {
      gameType: "bobs27",
      config: {},
      players: ["A", "B"],
      winner: "B",
      perPlayer: { A: { finalScore: 0, doublesHit: 12, busted: true, dartsThrown: 30 }, B: { finalScore: 5, doublesHit: 3, busted: false, dartsThrown: 63 } },
    },
  });
  assert.deepEqual(bobs.rows.map((r) => r.u), ["B", "A"]);
  assert.equal(bobs.ranked, false);
  assert.ok(bobs.rows[1].stats.some((st) => st.label === "busted"));
  assert.deepEqual(bobs.highlights.map((h) => [h.label, h.player]), [["Most doubles", "A"]]);

  // checkout drill: more hits wins, fewer darts breaks the tie
  const co = buildSummary({
    match: {
      gameType: "checkoutDrill",
      config: { count: 5 },
      players: ["A", "B"],
      winner: "B",
      perPlayer: { A: { finishes: 5, hit: 3, dartsThrown: 40, highestCheckout: 100 }, B: { finishes: 5, hit: 3, dartsThrown: 33, highestCheckout: 80 } },
    },
  });
  assert.deepEqual(co.rows.map((r) => r.u), ["B", "A"]);
  assert.equal(co.rows[0].primary.label, "of 5");
  assert.deepEqual(co.highlights.map((h) => [h.label, h.value, h.player]), [["Highest checkout", 100, "A"]]);
});

test("name tags ride on the summary rows", () => {
  const s = buildSummary({ match: x01Match, game: null, eloBefore: null, eloAfter: null, colors: {}, meta: { Ann: { tag: "BB", tagIcon: "crown" } } });
  const ann = s.rows.find((r) => r.u === "Ann");
  assert.equal(ann.tag, "BB");
  assert.equal(ann.tagIcon, "crown");
  assert.equal(s.rows.find((r) => r.u !== "Ann").tag, null);
});
