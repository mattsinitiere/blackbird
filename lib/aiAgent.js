/**
 * The tool loop behind Blackbird AI, provider-neutral so it can be tested
 * with a fake model. Messages use one neutral shape:
 *   { role: "user" | "assistant", content }
 *   { role: "assistant", toolCalls: [{ id, name, args }] }
 *   { role: "tool", results: [{ id, name, result }] }
 * `step({ system, messages, tools, final })` asks the model for its next
 * move and returns { text, toolCalls }. On the last step `final` is true
 * and the adapter must stop the model calling tools.
 */

export const MAX_STEPS = 4;
const MAX_RESULT_CHARS = 12000;

/** Tool results are capped so one call can't blow the prompt budget. */
export function capResult(result) {
  let s = JSON.stringify(result ?? null);
  if (s.length <= MAX_RESULT_CHARS) return result;
  s = s.slice(0, MAX_RESULT_CHARS);
  return { truncated: true, partial: s };
}

/**
 * Progress callbacks (all optional):
 *   onStatus(text)  a friendly line per tool call, e.g. "Checking your record vs Chuck…"
 *   onDelta(text)   answer text as it streams (adapters that can stream call it)
 *   onReset()       text streamed during a step that then called tools: discard it
 * `toolStatus(name, args)` turns a tool call into its status line.
 */
export async function runAgent({ system, messages, tools, step, runTool, maxSteps = MAX_STEPS, onStatus, onDelta, onReset, toolStatus }) {
  const convo = [...messages];
  const calls = [];
  // what the run cost, for the request log (never the prompts themselves)
  const usage = { input: 0, output: 0, known: false };
  let steps = 0;
  let fallback = null;
  const meta = () => ({ usage: usage.known ? { input: usage.input, output: usage.output } : null, steps, fallback });
  for (let i = 0; i <= maxSteps; i++) {
    const final = i === maxSteps;
    let streamed = false;
    const out = await step({
      system,
      messages: convo,
      tools,
      final,
      onDelta: onDelta
        ? (d) => {
            streamed = true;
            onDelta(d);
          }
        : undefined,
    });
    steps++;
    if (out.usage && (out.usage.input != null || out.usage.output != null)) {
      usage.known = true;
      usage.input += out.usage.input || 0;
      usage.output += out.usage.output || 0;
    }
    if (out.fallback) fallback = out.fallback;
    const toolCalls = final ? [] : (out.toolCalls || []).slice(0, 4);
    if (!toolCalls.length) {
      // a model that can't stream still gets its answer to the client
      if (onDelta && !streamed && out.text) onDelta(out.text);
      return { text: out.text || "", calls, model: out.model, ...meta() };
    }
    if (streamed) onReset?.();
    for (const c of toolCalls) onStatus?.(toolStatus ? toolStatus(c.name, c.args || {}) : `Running ${c.name}…`);
    convo.push({ role: "assistant", toolCalls, content: out.text || "", raw: out.raw });
    // tools may fetch data (lib/data/scopedTools.js), so await them; the
    // calls in one step are independent and run together
    const results = await Promise.all(toolCalls.map(async (c) => ({ id: c.id, name: c.name, result: capResult(await runTool(c.name, c.args)) })));
    calls.push(...toolCalls.map((c) => c.name));
    convo.push({ role: "tool", results });
  }
  return { text: "", calls, ...meta() };
}
