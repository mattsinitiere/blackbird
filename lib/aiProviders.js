/**
 * Server-only adapters from the neutral agent messages (lib/aiAgent.js) to
 * each AI provider's API, with tool calling. The provider and model come
 * from AI_PROVIDER / AI_MODEL; keys from the matching *_API_KEY env var.
 */

export const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash", // free tier
  groq: "llama-3.3-70b-versatile", // free tier
  openai: "gpt-4o-mini", // paid
  anthropic: "claude-haiku-4-5", // paid
};

const MAX_TOKENS = 3000;

export class AIError extends Error {
  constructor(message, { status = 500, quota = false } = {}) {
    super(message);
    this.status = status;
    this.quota = quota;
  }
}

export function providerConfig(env = process.env) {
  const provider = (env.AI_PROVIDER || "openai").toLowerCase();
  const model = env.AI_MODEL || DEFAULT_MODELS[provider];
  const keyVar = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[provider];
  if (!keyVar) throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  const key = env[keyVar];
  if (!key) throw new Error(`${keyVar} is not set`);
  return { provider, model, key };
}

async function post(url, headers, body, label) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `${label} request failed (${r.status})`;
    throw new AIError(msg, { status: r.status, quota: r.status === 429 || /quota|rate limit|resource.?exhausted/i.test(msg) });
  }
  return data;
}

const asObj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : { value: v });

// ---- Gemini ----------------------------------------------------------------
function geminiContents(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "user", parts: m.results.map((r) => ({ functionResponse: { name: r.name, response: asObj(r.result) } })) });
    } else if (m.role === "assistant" && m.toolCalls) {
      // echo the model's own parts (they may carry thought signatures)
      const parts = m.raw?.gemini || [...(m.content ? [{ text: m.content }] : []), ...m.toolCalls.map((c) => ({ functionCall: { name: c.name, args: c.args || {} } }))];
      out.push({ role: "model", parts });
    } else {
      out.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content || "" }] });
    }
  }
  return out;
}

async function geminiStep(cfg, { system, messages, tools, final }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: geminiContents(messages),
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
  };
  if (tools?.length) {
    body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
    body.toolConfig = { functionCallingConfig: { mode: final ? "NONE" : "AUTO" } };
  }
  const data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {}, body, "Gemini");
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  const toolCalls = parts.filter((p) => p.functionCall).map((p, i) => ({ id: `g${i}`, name: p.functionCall.name, args: p.functionCall.args || {} }));
  return { text, toolCalls, raw: { gemini: parts }, model: `gemini/${cfg.model}` };
}

// ---- OpenAI / Groq ---------------------------------------------------------
function openaiMessages(system, messages) {
  const out = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "tool") {
      for (const r of m.results) out.push({ role: "tool", tool_call_id: r.id, content: JSON.stringify(r.result) });
    } else if (m.role === "assistant" && m.toolCalls) {
      out.push({ role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })) });
    } else {
      out.push({ role: m.role, content: m.content || "" });
    }
  }
  return out;
}

async function openaiStep(cfg, { system, messages, tools, final }) {
  const url = cfg.provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const body = { model: cfg.model, max_tokens: MAX_TOKENS, temperature: 0.7, messages: openaiMessages(system, messages) };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    body.tool_choice = final ? "none" : "auto";
  }
  const data = await post(url, { Authorization: `Bearer ${cfg.key}` }, body, cfg.provider);
  const msg = data?.choices?.[0]?.message || {};
  const toolCalls = (msg.tool_calls || []).map((c) => {
    let args = {};
    try {
      args = JSON.parse(c.function?.arguments || "{}");
    } catch {}
    return { id: c.id, name: c.function?.name, args };
  });
  return { text: msg.content || "", toolCalls, model: `${cfg.provider}/${cfg.model}` };
}

// ---- Anthropic -------------------------------------------------------------
function anthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: JSON.stringify(r.result) })) });
    } else if (m.role === "assistant" && m.toolCalls) {
      out.push({ role: "assistant", content: [...(m.content ? [{ type: "text", text: m.content }] : []), ...m.toolCalls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.args || {} }))] });
    } else {
      out.push({ role: m.role, content: m.content || "" });
    }
  }
  return out;
}

async function anthropicStep(cfg, { system, messages, tools, final }) {
  const body = { model: cfg.model, max_tokens: MAX_TOKENS, system, messages: anthropicMessages(messages) };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    body.tool_choice = final ? { type: "none" } : { type: "auto" };
  }
  const data = await post("https://api.anthropic.com/v1/messages", { "x-api-key": cfg.key, "anthropic-version": "2023-06-01" }, body, "Anthropic");
  const blocks = data?.content || [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  const toolCalls = blocks.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id, name: b.name, args: b.input || {} }));
  return { text, toolCalls, model: `anthropic/${cfg.model}` };
}

/** A `step` function for runAgent, bound to the configured provider. */
export function makeStep(cfg) {
  const fn = cfg.provider === "gemini" ? geminiStep : cfg.provider === "anthropic" ? anthropicStep : openaiStep;
  return (args) => fn(cfg, args);
}
