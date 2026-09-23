import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { normalizeHandle, validateHandle, suggestHandle } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invite-only sign-up. Public self-service sign-up stays OFF in Supabase;
 * this route checks a shared invite code and, if it matches, sends the
 * Supabase invite email through the admin API. The link in that email lands
 * on /signup/accept, where the player chooses a password. Accepting the
 * invite also confirms the address.
 */

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function sameCode(given, expected) {
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

// Best-effort brake on code guessing, per server instance. Supabase's own
// auth rate limits apply on top of this.
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
function tooMany(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, since: now };
  if (now - rec.since > WINDOW_MS) {
    rec.count = 0;
    rec.since = now;
  }
  rec.count += 1;
  attempts.set(ip, rec);
  if (attempts.size > 5000) attempts.clear();
  return rec.count > MAX_ATTEMPTS;
}

function siteOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const inviteCode = process.env.SIGNUP_INVITE_CODE;

  if (!url || !serviceKey) return json({ error: "Sign-up is not available right now." }, 503);
  if (!inviteCode) return json({ error: "Sign-up is closed." }, 403);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return json({ error: "Too many attempts. Try again later." }, 429);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const code = String(body?.code || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const displayName = String(body?.displayName || "").trim();
  const handle = normalizeHandle(body?.handle) || suggestHandle(displayName);

  if (!code || !sameCode(code, inviteCode)) return json({ error: "That invite code isn't right." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email." }, 400);
  if (!displayName || displayName.length > 40) return json({ error: "Enter a display name (up to 40 characters)." }, 400);
  const check = validateHandle(handle);
  if (!check.ok) return json({ error: check.reason }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, handle },
    redirectTo: `${siteOrigin(req)}/signup/accept`,
  });

  if (error) {
    const text = (error.message || "").toLowerCase();
    if (error.status === 422 || text.includes("already") || text.includes("exists")) {
      return json({ error: "That email already has an account. Try signing in." }, 409);
    }
    return json({ error: "Couldn't send the invite. Try again in a minute." }, 502);
  }

  return json({ ok: true });
}
