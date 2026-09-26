import { createClient } from "@supabase/supabase-js";
import { parseGameSave, planGameSave } from "@/lib/gameSave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "matthews@finishessolutions.com").toLowerCase();

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Save one finished game. The database no longer lets the browser insert
 * game_results or change anyone's Elo, so every save comes through here:
 * the caller must have played in the game (or be the admin), and Elo is
 * computed from the stored ratings (lib/gameSave.js). Safe to retry: a
 * game_id that already has rows is not saved again.
 */
export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceKey) return json({ error: "Saving games isn't configured on the server." }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ error: "Not signed in." }, 401);

  const caller = createClient(url, anon);
  const { data: who, error: whoErr } = await caller.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "Session invalid. Sign in again." }, 401);
  const isAdmin = (who.user.email || "").toLowerCase() === ADMIN_EMAIL;

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const parsed = parseGameSave(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { match } = parsed;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // a retried save (network dropped mid-way) must not insert the game twice
    const { data: existing, error: selErr } = await admin
      .from("game_results")
      .select("game_id")
      .eq("game_id", match.gameId)
      .limit(1);
    if (selErr) throw selErr;
    if (existing && existing.length) return json({ ok: true, already: true });

    const { data: mine, error: meErr } = await admin
      .from("players")
      .select("username")
      .eq("auth_id", who.user.id)
      .limit(1);
    if (meErr) throw meErr;

    const { data: rowsIn, error: pErr } = await admin
      .from("players")
      .select("username, elo")
      .in("username", match.players);
    if (pErr) throw pErr;
    const currentElo = Object.fromEntries((rowsIn || []).map((p) => [p.username, p.elo]));

    const plan = planGameSave({
      match,
      callerUsername: mine?.[0]?.username || null,
      isAdmin,
      knownPlayers: (rowsIn || []).map((p) => p.username),
      currentElo,
    });
    if (!plan.ok) return json({ error: plan.error }, plan.status);

    if (plan.rows.length) {
      const { error: insErr } = await admin.from("game_results").insert(plan.rows);
      // 23505: a concurrent retry of the same game got there first
      if (insErr?.code === "23505") return json({ ok: true, already: true });
      if (insErr) throw insErr;
    }
    if (plan.elo) {
      for (const [username, elo] of Object.entries(plan.elo)) {
        const { error: updErr } = await admin.from("players").update({ elo }).eq("username", username);
        if (updErr) throw updErr;
      }
    }
    return json({ ok: true, elo: plan.elo });
  } catch (err) {
    return json({ error: err?.message || "Couldn't save the game." }, 500);
  }
}
