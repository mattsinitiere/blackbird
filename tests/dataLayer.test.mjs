import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate, supabasePager, isAfter, micros } from "../lib/data/paginate.js";
import { fetchResults, LIGHT } from "../lib/data/queries.js";
import { buildCoverage, coverageNote } from "../lib/data/coverage.js";
import { dayKey, weekKey, monthKey, monthRange, weekRange, dayWindow } from "../lib/data/tz.js";
import { createScopedToolRunner, makeResolver } from "../lib/data/scopedTools.js";
import { myPlayerFrom, NotLinkedError } from "../lib/data/serverData.js";
import { computeStats } from "../lib/stats.js";
import { resultFromRow } from "../lib/practice.js";
import { createToolRunner } from "../lib/aiTools.js";
import { fakeSupabase, manyRows } from "./helpers/fakeSupabase.mjs";

const ids = (rows) => rows.map((r) => r.id);

test("2,500 rows with a server cap below the page size: every row once, in order, newest included", async () => {
  const rows = manyRows(2500);
  const sb = fakeSupabase(rows, { cap: 300 }); // PostgREST cut every page to 300
  const page = await paginate(supabasePager(() => sb.from("game_results").select("*")), { pageSize: 1000, asOf: "2030-01-01T00:00:00Z" });
  assert.equal(page.status, "complete");
  assert.equal(page.rows.length, 2500);
  assert.equal(new Set(ids(page.rows)).size, 2500, "no duplicates");
  assert.deepEqual(ids(page.rows), ids(rows), "no skips, stable order");
  assert.equal(page.rows.at(-1).id, rows.at(-1).id, "the newest row beyond the old 1000-row boundary is there");
  // it kept going after short pages and stopped only on an empty one
  assert.equal(page.pages, Math.ceil(2500 / 300) + 1);
});

test("a big group of identical timestamps straddling page boundaries is walked exactly once", async () => {
  const rows = manyRows(1200);
  const tie = rows[400].completed_at;
  for (let i = 380; i < 620; i++) rows[i].completed_at = tie; // 240 rows, one instant
  rows.sort((a, b) => micros(a.completed_at) - micros(b.completed_at) || (a.id < b.id ? -1 : 1));
  for (const pageSize of [100, 240, 250, 400]) {
    const sb = fakeSupabase(rows, { cap: 1000 });
    const page = await paginate(supabasePager(() => sb.from("game_results").select("*")), { pageSize, asOf: "2030-01-01T00:00:00Z" });
    assert.equal(page.rows.length, 1200, `page size ${pageSize}`);
    assert.deepEqual(ids(page.rows), ids(rows), `page size ${pageSize}`);
  }
});

test("exact page-boundary counts: 1000 rows at page size 1000 still end on an empty page", async () => {
  const rows = manyRows(1000);
  const sb = fakeSupabase(rows);
  const page = await paginate(supabasePager(() => sb.from("game_results").select("*")), { pageSize: 1000, asOf: "2030-01-01T00:00:00Z" });
  assert.equal(page.rows.length, 1000);
  assert.equal(page.pages, 2);
  assert.equal(page.status, "complete");
});

test("microsecond timestamps: rows a few µs apart are not treated as a tie", () => {
  const a = { completed_at: "2026-09-01T10:00:00.123456+00:00", id: "a" };
  const cursor = { ts: "2026-09-01T10:00:00.123400+00:00", id: "z" };
  assert.equal(isAfter(a, cursor), true);
});

test("the as-of bound leaves out rows finished after the walk started", async () => {
  const rows = manyRows(50);
  const asOf = rows[29].completed_at;
  const sb = fakeSupabase(rows);
  const page = await paginate(supabasePager(() => sb.from("game_results").select("*")), { asOf });
  assert.ok(page.rows.every((r) => micros(r.completed_at) <= micros(asOf)));
  assert.equal(page.asOf, asOf);
});

test("hitting a safety bound reports partial coverage, never complete", async () => {
  const rows = manyRows(900);
  const sb = fakeSupabase(rows, { cap: 100 });
  const page = await paginate(supabasePager(() => sb.from("game_results").select("*")), { pageSize: 100, maxPages: 3, asOf: "2030-01-01T00:00:00Z" });
  assert.equal(page.status, "partial");
  assert.match(page.reason, /page limit/);
  assert.equal(page.rows.length, 300);
  const cov = buildCoverage({ page, rows: page.rows.map((r) => resultFromRow(r, 1000)), hasStats: true });
  assert.equal(cov.status, "partial");
  assert.match(coverageNote(cov), /incomplete/);
});

test("a server that keeps returning the same page is stopped, not looped", async () => {
  const stuck = manyRows(5);
  const page = await paginate(async () => ({ data: stuck, error: null }), { asOf: "2030-01-01T00:00:00Z" });
  assert.equal(page.status, "partial");
  assert.match(page.reason, /cursor stopped advancing/);
  assert.equal(page.rows.length, 5);
});

test("newest-N reads return the actual latest qualifying rows, oldest first, labelled as a sample", async () => {
  const rows = manyRows(2500);
  const sb = fakeSupabase(rows, { cap: 300 });
  const { rows: got, coverage } = await fetchResults(sb, { username: "Ann", includePractice: false }, { newest: 15 });
  const expected = rows.filter((r) => r.result !== "practice").slice(-15);
  assert.deepEqual(got.map((r) => r.id), expected.map((r) => r.id));
  assert.equal(coverage.status, "sample");
  assert.equal(coverage.distinctGames, 15);
});

test("filters are pushed into the query: player, mode, window, ranked, opponent", async () => {
  const rows = [...manyRows(300, { username: "Ann" }), ...manyRows(300, { username: "Cat", gameType: "cricket" })];
  const seen = [];
  const sb = fakeSupabase(rows, { onQuery: (st) => seen.push(st.filters.length) });
  const from = new Date(rows[100].completed_at);
  const { rows: got, coverage } = await fetchResults(sb, { username: "Ann", gameType: "x01", from, ranked: true, opponent: "Bob" });
  assert.ok(got.length > 0);
  assert.ok(got.every((r) => r.username === "Ann" && r.gameType === "x01" && r.result !== "practice" && r.opponents.includes("Bob") && new Date(r.completedAt) >= from));
  assert.ok(seen.every((n) => n >= 5), "filters applied by the query, not afterwards");
  assert.deepEqual(coverage.filters.username, "Ann");
  // LIGHT reads carry no stats, so log coverage is unknown rather than zero
  const light = await fetchResults(sb, { username: "Ann", columns: LIGHT });
  assert.equal(light.coverage.withLogs, null);
});

test("row-level security is respected: invisible rows never come back", async () => {
  const rows = [...manyRows(50, { username: "Ann" }), ...manyRows(50, { username: "Zed" })];
  const sb = fakeSupabase(rows, { visible: (r) => r.username !== "Zed" });
  const { rows: got } = await fetchResults(sb, { username: "Zed" });
  assert.equal(got.length, 0);
});

test("aggregates from paginated rows match the trusted stats on the same history (result-row grain)", async () => {
  const raw = [...manyRows(1500, { username: "Ann" }), ...manyRows(1500, { username: "Bob" })];
  const sb = fakeSupabase(raw, { cap: 250 });
  const { rows } = await fetchResults(sb, {});
  const trusted = computeStats(raw.map((r) => resultFromRow(r, 1000)).filter((r) => r.result !== "practice"));
  const fromPages = computeStats(rows.filter((r) => r.result !== "practice"));
  assert.deepEqual(fromPages.Ann, trusted.Ann);
  assert.deepEqual(fromPages.Bob, trusted.Bob);
  // one row per player per game: Ann's count equals her distinct games
  const annGames = new Set(rows.filter((r) => r.username === "Ann" && r.result !== "practice").map((r) => r.gameId));
  assert.equal(fromPages.Ann.games, annGames.size);
});

test("reporting-timezone calendar: days, Monday weeks and months across DST changes", () => {
  // 2026-03-08 02:00 CST -> CDT; 05:30Z is still Mar 7 local
  assert.equal(dayKey("2026-03-08T05:30:00Z"), "2026-03-07");
  assert.equal(dayKey("2026-03-08T06:30:00Z"), "2026-03-08");
  // a Sunday late evening local is still that Sunday's week (Mon Mar 2)
  assert.equal(weekKey("2026-03-09T04:59:00Z"), "2026-03-02");
  assert.equal(weekKey("2026-03-09T05:00:00Z"), "2026-03-09");
  assert.equal(monthKey("2026-11-01T04:59:59Z"), "2026-10");
  const oct = monthRange(new Date("2026-10-15T12:00:00Z"));
  assert.equal(oct.from.toISOString(), "2026-10-01T05:00:00.000Z"); // CDT midnight
  assert.equal(oct.to.toISOString(), "2026-11-01T05:00:00.000Z");
  const nov = monthRange(new Date("2026-11-15T12:00:00Z"));
  assert.equal(nov.from.toISOString(), "2026-11-01T05:00:00.000Z");
  assert.equal(nov.to.toISOString(), "2026-12-01T06:00:00.000Z"); // CST midnight
  const wk = weekRange(new Date("2026-10-29T12:00:00Z"));
  assert.equal((wk.to - wk.from) / 3600000, 169, "the week containing the fall-back change has 169 hours");
  const w = dayWindow("2026-03-08", "2026-03-08");
  assert.equal((w.to - w.from) / 3600000, 23, "spring-forward day is 23 hours");
});

test("scoped tools fetch only the player's rows and report coverage", async () => {
  const raw = [...manyRows(1200, { username: "Ann" }), ...manyRows(40, { username: "Bob" })];
  const sb = fakeSupabase(raw, { cap: 300 });
  const calls = [];
  const runner = createScopedToolRunner({
    fetch: (f, o) => {
      calls.push(f);
      return fetchResults(sb, f, o);
    },
    players: [{ username: "Ann", handle: "ann" }, { username: "Bob", handle: "bobby" }],
    me: "Ann",
  });
  const out = await runner.run("get_stats", { player: "@bobby" });
  assert.equal(out.player, "Bob");
  assert.equal(calls[0].username, "Bob");
  assert.equal(out.coverage.status, "complete");
  const q = await runner.run("query_games", { limit: 5 });
  assert.equal(q.player, "Ann");
  assert.equal(q.matched, raw.filter((r) => r.username === "Ann" && r.result !== "practice").length, "the full match count, not a first page");
  // same answer as the old in-memory runner over everything
  const legacy = createToolRunner({ rows: raw.map((r) => resultFromRow(r, 1000)), players: [{ username: "Ann" }, { username: "Bob", handle: "bobby" }], me: "Ann" });
  const { coverage, ...scoped } = await runner.run("get_stats", {});
  assert.deepEqual(scoped, legacy.run("get_stats", {}));
});

test("identity comes from the session's auth id, never a name the browser sends", () => {
  const players = [{ username: "Ann", authId: "u-ann" }, { username: "Bob", authId: "u-bob" }];
  assert.equal(myPlayerFrom(players, "u-bob").username, "Bob");
  assert.throws(() => myPlayerFrom(players, "u-nobody"), NotLinkedError);
  const resolve = makeResolver(players, "Ann");
  assert.equal(resolve(null), "Ann");
  assert.equal(resolve("bo"), "Bob");
});
