import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_STYLES, normalizeStyle, styleLine, DEFAULT_STYLE } from "../lib/answerStyle.js";
import { providerConfig, openaiBody, BUDGETS } from "../lib/aiProviders.js";
import { MAX_STEPS } from "../lib/aiAgent.js";

test("Answer Style is Brief / Balanced / Detailed, defaulting to Balanced", () => {
  assert.deepEqual(ANSWER_STYLES.map((s) => s.label), ["Brief", "Balanced", "Detailed"]);
  assert.equal(DEFAULT_STYLE, "balanced");
  assert.equal(normalizeStyle("deep"), "balanced");
  assert.equal(normalizeStyle(undefined), "balanced");
  // nothing in the copy claims more reasoning, a smarter model or extra computation
  for (const s of ANSWER_STYLES) assert.doesNotMatch(`${s.label} ${s.hint} ${styleLine(s.id)}`, /think|reason|smart|model|comput/i);
});

test("every Answer Style sends the same model, effort, token ceiling and tools; only the prompt text differs", () => {
  const cfg = providerConfig({ OPENAI_API_KEY: "k" });
  const tools = [{ name: "t", description: "d", parameters: { type: "object", properties: {} } }];
  const bodies = ANSWER_STYLES.map((s) => {
    const system = `base prompt\n\n${styleLine(s.id)}`;
    const { messages, ...rest } = openaiBody(cfg, { system, messages: [{ role: "user", content: "q" }], tools, final: false });
    return rest;
  });
  for (const b of bodies) {
    assert.deepEqual(b, bodies[0]);
    assert.equal(b.model, "gpt-6-luna");
    assert.equal(b.reasoning_effort, "none");
    assert.equal(b.max_completion_tokens, BUDGETS.openaiMaxCompletion);
  }
  assert.equal(MAX_STEPS, 4, "one tool-loop budget for all styles");
});
