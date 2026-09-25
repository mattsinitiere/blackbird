/**
 * Shared server plumbing for the AI routes (/api/insights, /api/plans):
 * who is calling (from their session token, never from the request body),
 * a Supabase client that acts as them (so row-level security applies), the
 * daily allowance, one plain model call, and user-facing error text.
 */

import { createClient } from "@supabase/supabase-js";
import { providerConfig, makeStep } from "./aiProviders.js";

export const DAILY_LIMIT = 50;

/** { user, sb, token } for a valid Bearer token, or null. */
export async function authenticate(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !sUrl || !sKey) return null;
  const anon = createClient(sUrl, sKey, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) return null;
  const sb = createClient(sUrl, sKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  return { user: data.user, sb, token };
}

/**
 * Take one request from the user's daily allowance (ai_take_request in
 * supabase/migration-ai-usage.sql). Returns the requests left, null when
 * unlimited, or throws a 429-style error when it's used up.
 */
export async function takeRequest(sb) {
  const { data, error } = await sb.rpc("ai_take_request", { p_limit: DAILY_LIMIT });
  if (error) {
    const e = new Error("Couldn't check your AI allowance. Try again in a moment.");
    e.status = 503;
    throw e;
  }
  if (data === -1) {
    const e = new Error(`You've used today's ${DAILY_LIMIT} AI requests. They reset at midnight (Central).`);
    e.status = 429;
    e.limit = true;
    throw e;
  }
  return data; // number left, or null (unlimited)
}

/** One plain model call (no tools), with usage for the log. */
export async function callAI({ system, user, turns = [] }) {
  const cfg = providerConfig();
  const out = await makeStep(cfg)({ system, messages: [...turns, { role: "user", content: user }], tools: null, final: true });
  return { text: out.text || "", model: out.model, usage: out.usage || null, fallback: out.fallback || null, effort: cfg.effort };
}

/** Status and message safe to show a player. */
export function friendlyError(e) {
  if (e?.limit || e?.status === 503 || e?.status === 409) return { status: e.status, error: e.message };
  const msg = e?.message || "AI request failed";
  if (/_API_KEY is not set|Unknown AI_PROVIDER/.test(msg)) return { status: 503, error: "Blackbird AI isn't switched on yet. The site owner needs to add an AI provider key." };
  if (e?.config) return { status: 503, error: "Blackbird AI is misconfigured on the server, so it can't answer right now. The site owner has been told what to fix." };
  if (e?.quota) return { status: 429, error: "Blackbird AI has hit its usage limit for now. Try again in a minute (or tomorrow if it keeps happening)." };
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return { status: 504, error: "Blackbird AI took too long to answer. Try again." };
  return { status: 500, error: msg };
}

export function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
