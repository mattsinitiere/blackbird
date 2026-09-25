import { test } from "node:test";
import assert from "node:assert/strict";
import { openaiBody, unsupportedParam, makeStep, providerConfig } from "../lib/aiProviders.js";

const msgs = { system: "s", messages: [{ role: "user", content: "hi" }], tools: [{ name: "t", description: "d", parameters: { type: "object", properties: {} } }], final: false };

test("OpenAI gets max_completion_tokens and no temperature; Groq keeps the old names", () => {
  const o = openaiBody({ provider: "openai", model: "gpt-6-luna" }, msgs);
  assert.ok(o.max_completion_tokens > 0);
  assert.equal("max_tokens" in o, false);
  assert.equal("temperature" in o, false);
  assert.equal(o.tool_choice, "auto");
  assert.equal(openaiBody({ provider: "openai", model: "m", effort: "low" }, msgs).reasoning_effort, "low");
  const g = openaiBody({ provider: "groq", model: "llama" }, { ...msgs, final: true });
  assert.ok(g.max_tokens > 0 && g.temperature != null);
  assert.equal(g.tool_choice, "none");
});

test("unsupportedParam reads the parameter out of OpenAI's error", () => {
  assert.equal(unsupportedParam("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead."), "max_tokens");
  assert.equal(unsupportedParam("Unsupported value: 'temperature' does not support 0.7 with this model."), "temperature");
  assert.equal(unsupportedParam("Something else"), null);
});

test("providerConfig reads the optional reasoning effort", () => {
  const c = providerConfig({ AI_PROVIDER: "openai", AI_MODEL: "gpt-6-luna", OPENAI_API_KEY: "k", AI_REASONING_EFFORT: "Medium" });
  assert.equal(c.effort, "medium");
  assert.equal(providerConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k", AI_REASONING_EFFORT: "turbo" }).effort, null);
});

test("an unsupported parameter is dropped and the call retried once", async () => {
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (bodies.length === 1) return { ok: false, status: 400, json: async () => ({ error: { message: "Unsupported parameter: 'reasoning_effort' is not supported with this model." } }) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Hello", tool_calls: [{ id: "c1", function: { name: "t", arguments: "{\"a\":1}" } }] } }] }) };
  };
  try {
    const out = await makeStep({ provider: "openai", model: "m", key: "k", effort: "low" })(msgs);
    assert.equal(out.text, "Hello");
    assert.deepEqual(out.toolCalls, [{ id: "c1", name: "t", args: { a: 1 } }]);
    assert.equal(bodies.length, 2);
    assert.equal("reasoning_effort" in bodies[1], false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("streamed chunks become text deltas and whole tool calls", async () => {
  const { openaiStreamCollector, readSSE } = await import("../lib/aiProviders.js");
  const deltas = [];
  const col = openaiStreamCollector((d) => deltas.push(d));
  const chunks = [
    { choices: [{ delta: { content: "You " } }] },
    { choices: [{ delta: { content: "lead." } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "get_", arguments: "{\"opp" } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "stats", arguments: "onent\":\"Chuck\"}" } }] } }] },
  ];
  const sse = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  const body = new Response(sse).body;
  await readSSE(body, (c) => col.push(c));
  const r = col.result();
  assert.deepEqual(deltas, ["You ", "lead."]);
  assert.equal(r.text, "You lead.");
  assert.deepEqual(r.toolCalls, [{ id: "c1", name: "get_stats", args: { opponent: "Chuck" } }]);
});
