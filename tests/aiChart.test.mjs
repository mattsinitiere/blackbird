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
