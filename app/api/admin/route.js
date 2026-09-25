import { createClient } from "@supabase/supabase-js";
import { normalizeHandle, validateHandle } from "@/lib/profile";
import { validateNewAccount, createAccount, validateTagEdit } from "@/lib/adminAccount";
import { buildAnalytics, rangeFor } from "@/lib/adminAnalytics";
import { paginate, supabasePager } from "@/lib/data/paginate";
import { renamePlayerEverywhere } from "@/lib/playerRename";
import { deleteAccount, isDeletedPlayerName } from "@/lib/accountDeletion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "matthews@finishessolutions.com").toLowerCase();

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) return json({ error: "Server is not configured (Supabase URL / anon key missing)." }, 500);

  // 1) verify the caller is signed in
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ error: "Not signed in." }, 401);

  const caller = createClient(url, anon);
  const { data: who, error: whoErr } = await caller.auth.getUser(token);
  if (whoErr || !who?.user) return json({ error: "Session invalid. Sign in again." }, 401);

  // 2) verify the caller is the admin
  if ((who.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "You are not allowed to use the admin panel." }, 403);
  }

  // 3) the admin client needs the service_role key
  if (!serviceKey) {
    return json(
      { error: "Admin features need SUPABASE_SERVICE_ROLE_KEY set on the server (Vercel env var)." },
      500
    );
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const action = body?.action;

  try {
    if (action === "analytics") {
      const range = rangeFor(body?.range);
      const since = range.from ? range.from.toISOString() : null;
      const sinceDay = since ? since.slice(0, 10) : null;
      // every auth user, page by page (sign-ups)
      const users = [];
      for (let page = 1; page <= 50; page++) {
        const { data: lu, error: le } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (le) throw le;
        const batch = lu?.users || [];
        users.push(...batch.map((u) => ({ id: u.id, createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || null })));
        if (batch.length < 1000) break;
      }
      const opt = async (q) => {
        const { data, error } = await q;
        return error ? null : data || [];
      };
      const [players, events, aiLog, aiUsage, plans, completions] = await Promise.all([
        opt(admin.from("players").select("username, auth_id").limit(10000)),
        opt((since ? admin.from("player_events").select("auth_id, kind, day").gte("day", sinceDay) : admin.from("player_events").select("auth_id, kind, day")).limit(50000)),
        opt((since ? admin.from("ai_request_log").select("auth_id, kind, model, effort, input_tokens, output_tokens, tool_calls, duration_ms, status, fallback, via, created_at").gte("created_at", since) : admin.from("ai_request_log").select("auth_id, kind, model, effort, input_tokens, output_tokens, tool_calls, duration_ms, status, fallback, via, created_at")).limit(50000)),
        opt((sinceDay ? admin.from("ai_usage").select("auth_id, day, count").gte("day", sinceDay) : admin.from("ai_usage").select("auth_id, day, count")).limit(50000)),
        opt(admin.from("training_plans").select("auth_id, source, created_at").limit(10000)),
        opt((since ? admin.from("plan_completions").select("completed_at").gte("completed_at", since) : admin.from("plan_completions").select("completed_at")).limit(50000)),
      ]);
      // games: keyset pages over the period, light columns only
      const page = await paginate(
        supabasePager(() => {
          const q = admin.from("game_results").select("id, game_id, username, game_type, result, opponents, completed_at");
          return since ? q.gte("completed_at", since) : q;
        })
      );
      const prices = {
        input: Number.isFinite(parseFloat(process.env.AI_PRICE_INPUT_PER_1M)) ? parseFloat(process.env.AI_PRICE_INPUT_PER_1M) : null,
        output: Number.isFinite(parseFloat(process.env.AI_PRICE_OUTPUT_PER_1M)) ? parseFloat(process.env.AI_PRICE_OUTPUT_PER_1M) : null,
      };
      const out = buildAnalytics(
        {
          users,
          players: (players || []).map((p) => ({ username: p.username, authId: p.auth_id })),
          events: events || [],
          games: page.rows,
          aiLog,
          aiUsage: aiUsage || [],
          plans,
          completions,
          prices,
        },
        range.id
      );
      out.coverage = { games: { status: page.status, reason: page.reason, rows: page.rows.length }, aiLog: aiLog !== null, plans: plans !== null };
      return json(out);
    }

    if (action === "list") {
      const { data: list, error: le } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (le) throw le;
      const users = (list?.users || []).map((u) => ({
        id: u.id,
        email: u.email || "",
        displayName: u.user_metadata?.display_name || "",
        createdAt: u.created_at,
      }));
      let players;
      let hasAuthIdCol = true;
      // newest column set first; older databases fall through
      const resTag = await admin
        .from("players")
        .select("username, hidden, created_at, auth_id, handle, tag, tag_icon")
        .order("created_at", { ascending: true });
      const res0 = resTag.error
        ? await admin
            .from("players")
            .select("username, hidden, created_at, auth_id, handle")
            .order("created_at", { ascending: true })
        : resTag;
      if (!res0.error) {
        players = res0.data;
      } else {
        const res1 = await admin
          .from("players")
          .select("username, hidden, created_at, auth_id")
          .order("created_at", { ascending: true });
        if (res1.error) {
          hasAuthIdCol = false;
          const res2 = await admin
            .from("players")
            .select("username, hidden, created_at")
            .order("created_at", { ascending: true });
          if (res2.error) throw res2.error;
          players = res2.data;
        } else {
          players = res1.data;
        }
      }

      if (hasAuthIdCol) {
        const usersByName = {};
        for (const u of users) {
          if (u.displayName) usersByName[u.displayName.toLowerCase()] = u.id;
        }
        for (const p of players) {
          if (!p.auth_id) {
            const matchId = usersByName[(p.username || "").toLowerCase()];
            if (matchId && !players.some((pp) => pp.auth_id === matchId)) {
              await admin.from("players").update({ auth_id: matchId }).eq("username", p.username);
              p.auth_id = matchId;
            }
          }
        }
      }

      return json({
        users,
        players: (players || []).map((p) => ({
          username: p.username,
          hidden: !!p.hidden,
          createdAt: p.created_at,
          authId: p.auth_id || null,
          handle: p.handle || null,
          tag: p.tag || null,
          tagIcon: p.tag_icon || null,
        })),
      });
    }

    if (action === "updateUser") {
      const { userId, email, password, displayName } = body;
      if (!userId) return json({ error: "Missing user." }, 400);
      const attrs = {};
      if (email) attrs.email = email;
      if (password) attrs.password = password;
      if (typeof displayName === "string") {
        // merge so we don't wipe the user's theme/accent settings
        const { data: existing } = await admin.auth.admin.getUserById(userId);
        const meta = existing?.user?.user_metadata || {};
        attrs.user_metadata = { ...meta, display_name: displayName };
      }
      if (Object.keys(attrs).length === 0) return json({ error: "Nothing to change." }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, attrs);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "deleteUser") {
      const { userId } = body;
      if (!userId) return json({ error: "Missing user." }, 400);
      const { players } = await deleteAccount(admin, userId);
      return json({ ok: true, players });
    }

    if (action === "deletePlayer") {
      const { username } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      await admin.from("game_results").delete().eq("username", username);
      const { error } = await admin.from("players").delete().eq("username", username);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "setHidden") {
      const { username, hidden } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      const { error } = await admin.from("players").update({ hidden: !!hidden }).eq("username", username);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "resetScore") {
      const { username } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      // per-player: delete only this player's rows; opponents keep theirs
      const { error: d1 } = await admin.from("game_results").delete().eq("username", username);
      if (d1) throw d1;
      const { error: d2 } = await admin.from("players").update({ elo: 1000 }).eq("username", username);
      if (d2) throw d2;
      return json({ ok: true });
    }

    if (action === "renamePlayer") {
      const { oldName, newName } = body;
      if (!oldName || !newName) return json({ error: "Missing old or new name." }, 400);
      const trimmed = newName.trim();
      if (!trimmed) return json({ error: "Name cannot be blank." }, 400);
      if (trimmed === oldName) return json({ error: "Name is the same." }, 400);
      if (isDeletedPlayerName(trimmed)) return json({ error: "That name is reserved for deleted accounts." }, 400);

      const { data: existing } = await admin.from("players").select("username").eq("username", trimmed).maybeSingle();
      if (existing) return json({ error: `"${trimmed}" already exists.` }, 400);

      await renamePlayerEverywhere(admin, oldName, trimmed);

      return json({ ok: true });
    }

    if (action === "setHandle") {
      // the service role bypasses the owner-only trigger, so the admin can
      // fix or assign anyone's handle; the same format rules still apply
      const { username, handle: rawHandle } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      const handle = normalizeHandle(rawHandle);
      const check = validateHandle(handle);
      if (!check.ok) return json({ error: check.reason }, 400);
      const { data: taken, error: te } = await admin
        .from("players")
        .select("username")
        .ilike("handle", handle)
        .neq("username", username)
        .limit(1);
      if (te) throw te;
      if (taken && taken.length > 0) return json({ error: `@${handle} is already taken by ${taken[0].username}.` }, 400);
      const { error } = await admin.from("players").update({ handle }).eq("username", username);
      if (error) throw error;
      return json({ ok: true, handle });
    }

    if (action === "createAccount") {
      // a full account: sign-in (email + password, already confirmed) and
      // its player row, created together
      const v = validateNewAccount(body);
      if (!v.ok) return json({ error: v.error }, 400);
      const r = await createAccount(admin, v.value);
      if (!r.ok) return json({ error: r.error }, 400);
      return json({ ok: true, username: r.username });
    }

    if (action === "setTag") {
      // the database still reserves the developer's gold icons for them
      const { username } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      const v = validateTagEdit(body);
      if (!v.ok) return json({ error: v.error }, 400);
      const { error } = await admin.from("players").update(v.value).eq("username", username);
      if (error) return json({ error: /reserved for the developer/i.test(error.message) ? "Those gold icons are reserved for the developer." : error.message }, 400);
      return json({ ok: true });
    }

    if (action === "linkPlayer") {
      const { username, authId } = body;
      if (!username) return json({ error: "Missing player." }, 400);
      const { error } = await admin.from("players").update({ auth_id: authId || null }).eq("username", username);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "rebuild") {
      return json({ error: "Rebuild has been disabled." }, 410);
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    return json({ error: err?.message || "Admin action failed." }, 500);
  }
}
