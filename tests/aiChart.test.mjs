import { test } from "node:test";
import assert from "node:assert/strict";
import { extractChart, resolveChart } from "../lib/aiChart.js";

const series = {
  checkoutPctByMonth: [
    { x: 1, y: 20, date: "2026-07", label: "Jul 26", n: 5 },
    { x: 2, y: 66.7, date: "2026-08", label: "Aug 26", n: 3 },
  ],
};

test("extractChart pulls the fenced block out of the prose", () => {
  const reply = "Your finishing improved.\n\n```chart\n{ \"type\": \"line\", \"title\": \"Checkout %\", \"unit\": \"%\", \"series\": \"checkoutPctByMonth\" }\n```\n\nKeep it up.";
  const { text, chart } = extractChart(reply);
  assert.equal(text, "Your finishing improved.\n\nKeep it up.");
  assert.equal(chart.series, "checkoutPctByMonth");
});

test("extractChart accepts a json fence wrapping a chart key and ignores other code", () => {
  const { text, chart } = extractChart("Hi\n```json\n{\"chart\":{\"type\":\"bar\",\"points\":[{\"label\":\"Sam\",\"y\":3}]}}\n```");
  assert.equal(text, "Hi");
  assert.equal(chart.type, "bar");
  const plain = extractChart("```\nnot json\n```\nok");
  assert.equal(plain.chart, null);
  assert.equal(plain.text, "```\nnot json\n```\nok");
  assert.equal(extractChart("no chart").chart, null);
});

test("resolveChart uses the app's own series by key", () => {
  const c = resolveChart({ type: "line", title: "Checkout %", unit: "%", series: "checkoutPctByMonth" }, series);
  assert.equal(c.type, "line");
  assert.equal(c.unit, "%");
  assert.equal(c.points.length, 2);
  assert.equal(c.points[1].y, 66.7);
  assert.equal(c.points[1].label, "Aug 26");
  const last = resolveChart({ series: "checkoutPctByMonth", last: 1 }, series);
  assert.equal(last.points.length, 1);
  assert.equal(last.points[0].y, 66.7);
});

test("resolveChart validates ad-hoc points and rejects junk", () => {
  const c = resolveChart({ type: "bar", points: [{ label: "Sam", y: "3" }, { label: "Kim", y: 1 }, { y: "nope" }, null], color: "live" }, series);
  assert.equal(c.type, "bar");
  assert.deepEqual(c.points.map((p) => [p.x, p.y, p.label]), [[1, 3, "Sam"], [2, 1, "Kim"]]);
  assert.equal(c.color, "var(--live)");
  assert.equal(resolveChart({ series: "missing" }, series), null);
  assert.equal(resolveChart({ points: [] }, series), null);
  assert.equal(resolveChart("nope", series), null);
  assert.equal(resolveChart({ series: "checkoutPctByMonth", decimals: 9 }, series).decimals, 2);
});

// ---- real-world malformed fences (Sept 2026 Gracie scouting reply) ----
import { extractBlocks as extractAll, visibleWhileStreaming as visibleNow } from "../lib/aiBlocks.js";

test("two-backtick, single-line, widget-labelled blocks are still recognised and removed", () => {
  const reply = [
    "You're close to Home Run Derby: your best game is 19 runs, against a 20-run target.",
    "",
    '``versus {"type": "versus", "opponent": "Gracie"} ``',
    "",
    '``chart {"type": "bar", "title": "Elo comparison", "unit": "Elo", "points": [{"label": "You", "y": 952}, {"label": "Gracie", "y": 949}]} ``',
    "",
    '``badges {"type": "badges", "title": "Closest to unlocking", "ids": ["home_run_derby"]} ``',
  ].join("\n");
  const out = extractAll(reply);
  assert.equal(out.charts.length, 3);
  assert.deepEqual(out.charts.map((c) => c.type), ["versus", "bar", "badges"]);
  assert.doesNotMatch(out.text, /`|\{"type"/);
  assert.match(out.text, /20-run target\.$/);
});

test("a block labelled with its widget type may omit type; followups with two backticks work too", () => {
  const out = extractAll('Hi.\n``versus\n{"opponent": "Gracie"}\n``\n``followups ["What about cricket?"]``');
  assert.equal(out.charts[0].type, "versus");
  assert.deepEqual(out.followups, ["What about cricket?"]);
  assert.equal(out.text, "Hi.");
});

test("normal three-backtick blocks still parse; code-like text that isn't a chart is left alone", () => {
  const out = extractAll('Text.\n```chart\n{"type": "line", "series": "x01AvgByGame"}\n```');
  assert.equal(out.charts.length, 1);
  assert.equal(out.text, "Text.");
  const plain = extractAll("Use ``T20`` then ``D16``.");
  assert.equal(plain.charts.length, 0);
  assert.equal(plain.text, "Use ``T20`` then ``D16``.");
});

test("while streaming, a half-written two-backtick block is hidden", () => {
  assert.equal(visibleNow('Great game.\n\n``versus {"type": "ver'), "Great game.");
});
