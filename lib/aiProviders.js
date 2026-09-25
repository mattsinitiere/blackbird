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
// reasoning models spend completion tokens thinking before they answer
const OPENAI_MAX_COMPLETION = 6000;

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
  const effort = ["minimal", "low", "medium", "high"].includes((env.AI_REASONING_EFFORT || "").toLowerCase()) ? env.AI_REASONING_EFFORT.toLowerCase() : null;
  const keyVar = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[provider];
  if (!keyVar) throw new Error(`Unknown AI_PROVIDER: ${provider}`);
  const key = env[keyVar];
  if (!key) throw new Error(`${keyVar} is not set`);
  return { provider, model, key, effort };
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

/**
 * The chat-completions body. OpenAI's current models take
 * max_completion_tokens and only the default temperature; Groq still
 * speaks the older max_tokens / temperature dialect.
 */
export function openaiBody(cfg, { system, messages, tools, final }) {
  const body = { model: cfg.model, messages: openaiMessages(system, messages) };
  if (cfg.provider === "groq") {
    body.max_tokens = MAX_TOKENS;
    body.temperature = 0.7;
  } else {
    body.max_completion_tokens = OPENAI_MAX_COMPLETION;
    if (cfg.effort) body.reasoning_effort = cfg.effort;
  }
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
    body.tool_choice = final ? "none" : "auto";
  }
  return body;
}

/** The parameter an "Unsupported parameter/value" error names, if any. */
export function unsupportedParam(message) {
  const m = /unsupported (?:parameter|value)[^'"]*['"]([a-z_]+)['"]/i.exec(String(message || ""));
  return m ? m[1] : null;
}

/** Read a server-sent-events body, calling onData with each parsed `data:` JSON. */
export async function readSSE(body, onData) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onData(JSON.parse(payload));
      } catch {}
    }
  }
}

/**
 * Fold streamed chat-completion chunks into { text, toolCalls }, passing
 * text to onDelta as it arrives. Tool-call arguments arrive in pieces,
 * keyed by index.
 */
export function openaiStreamCollector(onDelta) {
  let text = "";
  const calls = [];
  return {
    push(chunk) {
      const d = chunk?.choices?.[0]?.delta;
      if (!d) return;
      if (typeof d.content === "string" && d.content) {
        text += d.content;
        onDelta?.(d.content);
      }
      for (const t of d.tool_calls || []) {
        const i = t.index ?? calls.length;
        calls[i] = calls[i] || { id: "", name: "", args: "" };
        if (t.id) calls[i].id = t.id;
        if (t.function?.name) calls[i].name += t.function.name;
        if (t.function?.arguments) calls[i].args += t.function.arguments;
      }
    },
    result() {
      const toolCalls = calls.filter(Boolean).map((c, i) => {
        let args = {};
        try {
          args = JSON.parse(c.args || "{}");
        } catch {}
        return { id: c.id || `call_${i}`, name: c.name, args };
      });
      return { text, toolCalls };
    },
  };
}

/** True when an error says this model or organisation can't stream. */
export function streamRefused(e) {
  return e?.status === 400 && /stream/i.test(String(e?.message || ""));
}

async function openaiStep(cfg, args) {
  const url = cfg.provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  let stream = typeof args.onDelta === "function";
  let body = openaiBody(cfg, args);
  if (stream) body.stream = true;
  // a model that rejects one of our parameters gets one retry without it;
  // one that refuses to stream is asked again without streaming
  let retried = false;
  for (;;) {
    try {
      if (!stream) {
        const data = await post(url, { Authorization: `Bearer ${cfg.key}` }, body, cfg.provider);
        const msg = data?.choices?.[0]?.message || {};
        const toolCalls = (msg.tool_calls || []).map((c) => {
          let a = {};
          try {
            a = JSON.parse(c.function?.arguments || "{}");
          } catch {}
          return { id: c.id, name: c.function?.name, args: a };
        });
        return { text: msg.content || "", toolCalls, model: `${cfg.provider}/${cfg.model}` };
      }
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` }, body: JSON.stringify(body) });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        const msg = data?.error?.message || `${cfg.provider} request failed (${r.status})`;
        throw new AIError(msg, { status: r.status, quota: r.status === 429 || /quota|rate limit/i.test(msg) });
      }
      const col = openaiStreamCollector(args.onDelta);
      await readSSE(r.body, (chunk) => col.push(chunk));
      return { ...col.result(), model: `${cfg.provider}/${cfg.model}` };
    } catch (e) {
      if (stream && streamRefused(e)) {
        stream = false;
        body = { ...body };
        delete body.stream;
        continue;
      }
      const param = e.status === 400 ? unsupportedParam(e.message) : null;
      if (retried || !param || !(param in body) || ["messages", "model", "stream"].includes(param)) throw e;
      body = { ...body };
      delete body[param];
      if (param === "tools") delete body.tool_choice;
      retried = true;
    }
  }
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
