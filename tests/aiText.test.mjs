import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAIText, parseInline } from "../lib/aiText.js";

test("bold, italic and code become spans, not asterisks", () => {
  assert.deepEqual(parseInline("You hit **45.2** avg, *nice*."), [{ text: "You hit " }, { text: "45.2", bold: true }, { text: " avg, " }, { text: "nice", italic: true }, { text: "." }]);
  assert.deepEqual(parseInline("2 * 3 = 6"), [{ text: "2 * 3 = 6" }]);
  assert.deepEqual(parseInline("`T20`"), [{ text: "T20" }]);
});

test("paragraphs, lists and headings", () => {
  const b = parseAIText("## Your week\nGood week.\nKeep going.\n\n- **6** games\n- 50% wins\n1. Doubles\n2. Trebles");
  assert.deepEqual(b.map((x) => x.type), ["h", "p", "ul", "ol"]);
  assert.equal(b[1].spans[0].text, "Good week. Keep going.");
  assert.equal(b[2].items.length, 2);
  assert.equal(b[2].items[0][0].bold, true);
});
