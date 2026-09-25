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

test("providerConfig defaults to Luna with an explicit fixed effort of none", () => {
  const c = providerConfig({ OPENAI_API_KEY: "k" });
  assert.equal(c.provider, "openai");
  assert.equal(c.model, "gpt-6-luna");
  assert.equal(c.effort, "none");
  assert.equal(providerConfig({ AI_PROVIDER: "openai", AI_MODEL: "gpt-6-luna", OPENAI_API_KEY: "k", AI_REASONING_EFFORT: "Medium" }).effort, "medium");
  // blank AI_MODEL still means Luna, never another model
  assert.equal(providerConfig({ AI_MODEL: "  ", OPENAI_API_KEY: "k" }).model, "gpt-6-luna");
});

test("an invalid effort or provider fails clearly instead of being guessed", () => {
  assert.throws(() => providerConfig({ OPENAI_API_KEY: "k", AI_REASONING_EFFORT: "turbo" }), (e) => e.config === true && /AI_REASONING_EFFORT/.test(e.message));
  assert.throws(() => providerConfig({ AI_PROVIDER: "sol", OPENAI_API_KEY: "k" }), (e) => e.config === true);
  assert.throws(() => providerConfig({ AI_PROVIDER: "openai" }), /OPENAI_API_KEY is not set/);
});

test("reasoning_effort none is always sent with tools on the Chat Completions path", () => {
  const body = openaiBody(providerConfig({ OPENAI_API_KEY: "k" }), msgs);
  assert.equal(body.model, "gpt-6-luna");
  assert.equal(body.reasoning_effort, "none");
  assert.equal(body.tools.length, 1);
  assert.equal(body.tool_choice, "auto");
  // even a hand-built config without effort gets the explicit default
  assert.equal(openaiBody({ provider: "openai", model: "gpt-6-luna" }, msgs).reasoning_effort, "none");
});

test("a rejected reasoning_effort or tools parameter fails loudly; nothing is silently stripped", async () => {
  for (const param of ["reasoning_effort", "tools", "max_completion_tokens"]) {
    const bodies = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: false, status: 400, json: async () => ({ error: { message: `Unsupported parameter: '${param}' is not supported with this model.` } }) };
    };
    try {
      await assert.rejects(makeStep({ provider: "openai", model: "gpt-6-luna", key: "k", effort: "none" })(msgs), (e) => e.config === true && e.message.includes(param));
      assert.equal(bodies.length, 1, "no retry without the parameter");
    } finally {
      globalThis.fetch = realFetch;
    }
  }
});

test("usage is reported from the provider response", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Hi" } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }) });
  try {
    const out = await makeStep({ provider: "openai", model: "gpt-6-luna", key: "k", effort: "none" })(msgs);
    assert.deepEqual(out.usage, { input: 120, output: 30 });
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

test("a model that refuses to stream is asked again without streaming, keeping its tools", async () => {
  const bodies = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (body.stream) return { ok: false, status: 400, json: async () => ({ error: { message: "Your organization must be verified to stream this model." } }) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "", tool_calls: [{ id: "c1", function: { name: "t", arguments: "{}" } }] } }] }) };
  };
  try {
    const out = await makeStep({ provider: "openai", model: "m", key: "k" })({ ...msgs, onDelta: () => {} });
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].stream, true);
    assert.equal("stream" in bodies[1], false);
    assert.ok(bodies[1].tools?.length);
    assert.deepEqual(out.toolCalls, [{ id: "c1", name: "t", args: {} }]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
