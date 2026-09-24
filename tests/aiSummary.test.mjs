import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMySummary, describeGame } from "../lib/aiSummary.js";
import { computeStats } from "../lib/stats.js";

const T = (n) => ({ n, mult: 3 });
const D = (n) => ({ n, mult: 2 });
const S = (n) => ({ n, mult: 1 });

// Two months of 101 double-out legs between Matt and Sam. July: Matt hits
// 1 of 4 chances; August: 2 of 3. Dart logs are per player.
function row(id, username, date, winner, log, extra = {}) {
  const opp = username === "Matt" ? "Sam" : "Matt";
  return {
    gameId: `g${id}`,
    username,
    gameType: "x01",
    config: { startScore: 101, doubleOut: true },
    winner,
    result: winner === username ? "win" : "loss",
    opponents: [opp],
    stats: { dartsThrown: log.length, pointsScored: 101, highestTurn: 60, checkout: winner === username ? 40 : 0, darts: log },
    eloAfter: 1000 + id,
    completedAt: date,
    ...extra,
  };
}

// Matt's logs: chances and hits are deterministic from the replay
const hit1 = [T(20), S(1), S(20), D(10)]; // 101 → 41 → 40 → 20 → D10 out. chances: at 40 (S20 miss), at 20 (hit) = 2, hit 1
const miss = [T(20), S(1), S(20), S(5), S(5), S(5)]; // 101 → 41 → 40 → 20 → 15 → 10 → 5: chances at 40, 20, 10 = 3, hit 0
const hit2 = [T(20), S(1), D(20)]; // 101 → 41 → 40 → D20 out: chances 1, hit 1

const results = [
  ...[
    row(1, "Matt", "2026-07-03T20:00:00Z", "Matt", hit1),
    row(2, "Matt", "2026-07-10T20:00:00Z", "Sam", miss),
    row(3, "Matt", "2026-08-02T20:00:00Z", "Matt", hit2),
    row(4, "Matt", "2026-08-09T20:00:00Z", "Matt", hit1),
  ],
  row(1, "Sam", "2026-07-03T20:00:00Z", "Matt", miss),
  row(2, "Sam", "2026-07-10T20:00:00Z", "Sam", hit2),
  row(3, "Sam", "2026-08-02T20:00:00Z", "Matt", miss),
  row(4, "Sam", "2026-08-09T20:00:00Z", "Matt", miss),
];
const players = [
  { username: "Matt", elo: 1004, hidden: false },
  { username: "Sam", elo: 996, hidden: false },
];
const NOW = new Date("2026-08-20T12:00:00Z");

function build() {
  const stats = computeStats(results);
  return buildMySummary({ me: "Matt", stats, elo: { Matt: 1004, Sam: 996 }, results, practice: [], players, now: NOW });
}

test("describeGame derives per-game finishing numbers from the log", () => {
  const g = describeGame(results[0], "Matt");
  assert.equal(g.game, "x01");
  assert.equal(g.checkoutChances, 2);
  assert.equal(g.checkoutHit, 1);
  assert.equal(g.checkout, 40);
  assert.equal(g.threeDartAvg, 75.8); // 101 points in 4 darts
  assert.equal(g.date, "2026-07-03");
});

test("career checkout percentage and ranges", () => {
  const s = build();
  // chances: 2 + 3 + 1 + 2 = 8, hits: 3
  assert.equal(s.checkouts.chances, 8);
  assert.equal(s.checkouts.hits, 3);
  assert.equal(s.checkouts.pct, 37.5);
  // ranges bucket by the score the visit started on: hit2 takes out 101 in one visit
  assert.equal(s.checkouts.byRange["2-40"].chances, 4);
  assert.equal(s.checkouts.byRange["2-40"].hits, 2);
  assert.equal(s.checkouts.byRange["101-170"].chances, 4);
  assert.equal(s.checkouts.byRange["101-170"].hits, 1);
  assert.equal(s.checkouts.highest, 40);
  assert.equal(s.me.x01.checkoutPct, 37.5);
  assert.equal(s.me.games, 4);
  assert.equal(s.me.rankInCircle, 1);
  assert.equal(s.me.circleSize, 2);
});

test("monthly checkout trend is a named series with sample sizes", () => {
  const s = build();
  const m = s.series.checkoutPctByMonth;
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((p) => p.label), ["Jul 26", "Aug 26"]);
  assert.deepEqual(m.map((p) => p.y), [20, 66.7]); // 1/5 then 2/3
  assert.deepEqual(m.map((p) => p.n), [5, 3]);
  assert.equal(s.trends.byMonth[1].checkoutPct, 66.7);
  assert.equal(s.trends.byMonth[1].wins, 2);
  assert.equal(s.series.checkoutPctByGame.length, 4);
  assert.deepEqual(s.series.checkoutPctByGame.map((p) => p.y), [50, 0, 100, 50]);
  assert.equal(s.series.eloByGame[3].y, 1004);
});

test("form compares recent games and days", () => {
  const s = build();
  assert.equal(s.form.last10Games.games, 4);
  assert.equal(s.form.last30Days.games, 2); // both August games within 30 days of Aug 20
  assert.equal(s.form.last30Days.checkoutPct, 66.7);
  assert.equal(s.form.previous30Days.games, 2);
  assert.equal(s.form.previous30Days.checkoutPct, 20);
});

test("head to head and recent games carry no raw dart logs", () => {
  const s = build();
  assert.deepEqual(s.headToHead, [{ opponent: "Sam", wins: 3, losses: 1, games: 4, lastPlayed: "2026-08-09", winPct: 75, opponentElo: 996 }]);
  assert.equal(s.recentGames.length, 4);
  for (const g of s.recentGames) {
    assert.equal(g.darts, undefined);
    assert.equal(g._rp, undefined);
  }
  assert.ok(JSON.stringify(s).length < 12000);
});

test("a player with no games gets an empty but valid summary", () => {
  const s = buildMySummary({ me: "Zed", stats: {}, elo: {}, results: [], practice: [], players, now: NOW });
  assert.equal(s.me.games, 0);
  assert.equal(s.checkouts.pct, null);
  assert.deepEqual(s.series, {});
  assert.deepEqual(s.headToHead, []);
});
