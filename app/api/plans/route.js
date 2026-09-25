import { createClient } from "@supabase/supabase-js";
import { authenticate, takeRequest, callAI, friendlyError, jsonRes } from "@/lib/aiServer";
import { logAIRequest } from "@/lib/aiLog";
import { fetchResults } from "@/lib/data/queries";
import { loadPlayers, myPlayerFrom } from "@/lib/data/serverData";
import { validatePlanDefinition, planBaseline, needsStarter, starterPlan, GOALS, SESSION_MINUTES, ITEM_KINDS, LIMIT_MESSAGE, PLAN_BOUNDS } from "@/lib/trainingPlans";
import { BOTS } from "@/lib/bots";
import { parsePlanJSON } from "@/lib/planPrompt";
import { unplayableItems, unlockedBots } from "@/lib/planLaunch";
import { buildProfile } from "@/lib/alterEgo";

// Training plans that need the server (app/api/plans):
//   draft   Create With Merlin: a validated draft from the player's goal and
//           their own numbers. Nothing is saved; a failed draft costs no slot.
//   create  Save a plan (Merlin's or the builder's). Re-validated here, then
//           written through create_training_plan() with the service role,
//           which enforces the three-plan limit and idempotency.
// Listing, deleting and recording progress go straight to Supabase as the
// player, under row-level security (lib/db.js).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPAIR_ATTEMPTS = 1; // one retry with the validator's errors, then give up

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function draftInputs(b) {
  const goal = GOALS.find((g) => g.id === b?.goal) ? b.goal : null;
  const minutes = SESSION_MINUTES.includes(Number(b?.minutes)) ? Number(b.minutes) : 30;
  const perWeek = Math.min(PLAN_BOUNDS.perWeek[1], Math.max(PLAN_BOUNDS.perWeek[0], parseInt(b?.perWeek, 10) || 3));
  const weeks = Math.min(PLAN_BOUNDS.weeks[1], Math.max(PLAN_BOUNDS.weeks[0], parseInt(b?.weeks, 10) || 2));
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 140) : "";
  return { goal, minutes, perWeek, weeks, note };
}

export async function POST(req) {
  const started = Date.now();
  const who = await authenticate(req);
  if (!who) return jsonRes({ error: "Unauthorized" }, 401);
  const { user, sb } = who;
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Bad request" }, 400);
  }

  try {
    const players = await loadPlayers(sb);
    const me = myPlayerFrom(players, user.id).username;

    if (body?.action === "draft") {
      const input = draftInputs(body);
      if (!input.goal) return jsonRes({ error: "Pick a goal first." }, 400);
      // the player's own history only, read as them
      const { rows, coverage } = await fetchResults(sb, { username: me }, { requested: "your history, for the plan baseline" });
      const baseline = planBaseline(rows, me);
      if (input.goal === "assessment" || needsStarter(baseline)) {
        // not enough history to personalise: a labelled assessment, no AI call
        return jsonRes({ draft: starterPlan(), baseline, starter: true, coverage });
      }
      const left = await takeRequest(sb);
      const open = [...unlockedBots(rows.filter((r) => r.result === "practice"), me)];
      const alterEgoOk = buildProfile(rows, { me, window: "last10" }).ok;
      const { system, user: prompt } = buildPlanPrompt({ input, baseline, coverage, open, alterEgoOk });
      let lastErrors = null;
      let log = { usage: null, model: null, effort: null, steps: 0 };
      for (let attempt = 0; attempt <= REPAIR_ATTEMPTS; attempt++) {
        const turns = lastErrors ? [{ role: "user", content: prompt }, { role: "assistant", content: lastErrors.raw }] : [];
        const ask = lastErrors ? `That plan was rejected:\n- ${lastErrors.errors.join("\n- ")}\nReturn the corrected plan JSON only.` : prompt;
        const out = await callAI({ system, user: ask, turns });
        log = { usage: sumUsage(log.usage, out.usage), model: out.model, effort: out.effort, steps: log.steps + 1 };
        const parsed = parsePlanJSON(out.text);
        const v = parsed ? validatePlanDefinition({ ...parsed, goal: input.goal, weeks: input.weeks, perWeek: input.perWeek, minutesPerSession: input.minutes }) : { ok: false, errors: ["the reply was not a JSON plan"] };
        if (v.ok) {
          const blocked = unplayableItems(v.plan, { rows, me });
          if (blocked.length) Object.assign(v, { ok: false, errors: blocked.map((b) => `session ${b.session + 1} item ${b.item + 1}: ${b.reason}`) });
        }
        if (v.ok) {
          logAIRequest(sb, { kind: "plan", ...log, durationMs: Date.now() - started, status: "ok" });
          return jsonRes({ draft: v.plan, baseline, starter: false, coverage, left });
        }
        lastErrors = { errors: v.errors.slice(0, 8), raw: String(out.text || "").slice(0, 4000) };
      }
      logAIRequest(sb, { kind: "plan", ...log, durationMs: Date.now() - started, status: "error" });
      return jsonRes({ error: "Merlin couldn't put together a valid plan this time. Try again, or build your own.", left }, 502);
    }

    if (body?.action === "create") {
      const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";
      if (!/^[A-Za-z0-9-]{8,80}$/.test(requestKey)) return jsonRes({ error: "Bad request key" }, 400);
      const source = body.source === "ai" ? "ai" : "custom";
      const v = validatePlanDefinition(body.definition);
      if (!v.ok) return jsonRes({ error: "That plan isn't valid.", errors: v.errors }, 400);
      const svc = serviceClient();
      if (!svc) return jsonRes({ error: "Training plans aren't set up on the server yet." }, 503);
      // baseline recomputed here from the player's own rows, never trusted from the browser
      const { rows } = await fetchResults(sb, { username: me }, { requested: "plan baseline" });
      const baseline = planBaseline(rows, me);
      const blocked = unplayableItems(v.plan, { rows, me });
      if (blocked.length) return jsonRes({ error: "Some drills in that plan can't be played yet.", errors: blocked.map((b) => `Session ${b.session + 1}, drill ${b.item + 1}: ${b.reason}`) }, 400);
      const { data, error } = await svc.rpc("create_training_plan", { p_auth_id: user.id, p_request_key: requestKey, p_source: source, p_definition: v.plan, p_baseline: baseline });
      if (error) {
        if (/plan_limit/.test(error.message || "")) return jsonRes({ error: LIMIT_MESSAGE, limit: true }, 409);
        if (error.code === "PGRST202" || /create_training_plan/.test(error.message || "")) return jsonRes({ error: "Training plans aren't set up on the server yet." }, 503);
        throw error;
      }
      return jsonRes({ plan: data.plan, created: data.created });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (e) {
    const { status, error } = friendlyError(e);
    return jsonRes({ error, limit: !!e?.limit }, status);
  }
}

function sumUsage(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return { input: (a.input || 0) + (b.input || 0), output: (a.output || 0) + (b.output || 0) };
}

function buildPlanPrompt({ input, baseline, coverage, open, alterEgoOk }) {
  const goal = GOALS.find((g) => g.id === input.goal);
  const kinds = Object.entries(ITEM_KINDS)
    .map(([type, k]) => `${type} ${JSON.stringify(k.options)} (~${type === "bot" ? "12-15" : "varies"} min)`)
    .join("; ");
  const system =
    "You are Merlin, the practice coach inside the Blackbird darts app. Build a training plan as JSON only, no prose outside the JSON. " +
    "Use ONLY these item types with exactly these settings (anything else is rejected): " +
    kinds +
    `. Bots this player has unlocked (use no others): ${BOTS.filter((b) => open.includes(b.id)).map((b) => `${b.id} (avg ${b.avg})`).join(", ") || "only bot:rook"}. ` +
    (alterEgoOk ? "alterEgo is available (windows last10, last30d, prevMonth; prefer last10). " : "Do NOT use alterEgo: not enough X01 history. ") +
    "Shape: {\"title\": string (≤60), \"why\": string (≤400, what the plan targets and why, citing only numbers from BASELINE with their sample sizes), " +
    "\"sessions\": [{\"title\": string (≤40), \"focus\": string (≤60), \"items\": [{\"type\": ..., \"config\": {...}}]}]}. " +
    `Exactly ${input.weeks * input.perWeek} sessions (${input.weeks} weeks × ${input.perWeek} per week), 1 to 4 items each, each session about ${input.minutes} minutes ` +
    "(Checkout Drill 5/10/20 finishes ≈ 7/14/28 min; Scoring Drill 5/10/20 turns ≈ 4/7/12 min; Bob's 27 ≈ 12; Solo 301/501/701 ≈ 6/10/14; bot or Alter Ego ≈ 12-15). " +
    "Build difficulty gradually. Never invent weaknesses or numbers: null baseline values mean not enough data; say so rather than guessing. " +
    "Output the JSON object only.";
  const user = `GOAL: ${goal.label}${input.note ? ` (player's note: ${input.note})` : ""}\nTIME: ${input.minutes} minutes per session, ${input.perWeek} sessions a week for ${input.weeks} weeks.\nBASELINE (from ${coverage.distinctGames} of their games, ${coverage.status}): ${JSON.stringify(baseline)}`;
  return { system, user };
}
