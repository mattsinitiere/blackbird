/**
 * Operational log for Blackbird AI requests (supabase/migration-ai-log.sql).
 * Records what a request cost and how it went: model, fixed effort, token
 * counts, tool calls, duration, fallback. Never the question, the answer,
 * any prompt, API keys or game data.
 *
 * Written through ai_log_request(), which stamps the caller's own auth id,
 * so a user can only add rows about themselves. Logging must never break
 * an answer: every failure here is swallowed.
 */

const KINDS = new Set(["chat", "game", "weekly", "plan", "identity"]);
const STATUSES = new Set(["ok", "error", "limit", "empty"]);

/** A log entry with every field bounded to what the table accepts. */
export function logEntry({ kind, model = null, effort = null, usage = null, toolCalls = 0, steps = 0, durationMs = 0, status = "ok", fallback = null, via = null }) {
  const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);
  return {
    p_kind: KINDS.has(kind) ? kind : "chat",
    p_model: model ? String(model).slice(0, 80) : null,
    p_effort: effort ? String(effort).slice(0, 16) : null,
    p_input_tokens: int(usage?.input),
    p_output_tokens: int(usage?.output),
    p_tool_calls: int(toolCalls) ?? 0,
    p_steps: int(steps) ?? 0,
    p_duration_ms: int(durationMs) ?? 0,
    p_status: STATUSES.has(status) ? status : "error",
    p_fallback: fallback ? String(fallback).slice(0, 32) : null,
    p_via: via ? String(via).slice(0, 16) : null,
  };
}

/** Fire and forget. `sb` is the user's own Supabase client. */
export async function logAIRequest(sb, entry) {
  try {
    await sb.rpc("ai_log_request", logEntry(entry));
  } catch {
    // the log table may not exist yet (migration not applied); never fail the answer
  }
}
