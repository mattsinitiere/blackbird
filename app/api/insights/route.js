import { createClient } from "@supabase/supabase-js";
import { extractCharts, resolveCharts } from "@/lib/aiChart";
import { TOOL_DEFS, createToolRunner, describeMatch, weeklyData } from "@/lib/aiTools";
import { runAgent } from "@/lib/aiAgent";
import { providerConfig, makeStep } from "@/lib/aiProviders";
import { resultFromRow } from "@/lib/practice";
import { BASE_ELO } from "@/lib/constants";

// Runs on the server only. The AI key lives in a non-public env var and is
// never sent to the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The personal Blackbird AI tab: the signed-in player's own games, form,
// records, trends, practice and rivalries, with follow-up questions in
// context and an optional chart drawn from the app's own series.
const CHART_RULES =
  "CHARTS: when a chart helps (a trend, a comparison, a breakdown, or the player asks for a chart), append up to THREE fenced blocks after your prose, each on its own lines:\n" +
  "```chart\n{\"type\": \"line\", \"title\": \"Checkout % by month\", \"unit\": \"%\", \"decimals\": 1, \"series\": \"checkoutPctByMonth\"}\n```\n" +
  "Types: \"line\" (trends), \"bar\" (counts per period or category), \"stackedBar\" (several series stacked per period), " +
  "\"donut\" (a split, e.g. wins by game mode, with points [{\"label\": \"X01\", \"y\": 4}]), " +
  "\"stats\" (2 to 4 headline numbers: {\"type\": \"stats\", \"items\": [{\"label\": \"3-dart avg\", \"value\": \"52.4\"}]}). " +
  "`series` is one id or an array of up to four ids to compare (e.g. [\"s1\", \"s2\"] for you vs an opponent); add \"names\" for the legend. " +
  "Ids are the summary's series keys or ids returned by tools (s1, s2). Add \"last\": N to keep the most recent N points. " +
  "For a small comparison you computed yourself, use \"points\" with numbers taken straight from the data. " +
  "Never put a chart block mid-sentence, never chart data that isn't there, and never say you can't draw: the app renders the charts.\n\n";

const STYLE_RULES =
  "STYLE: be specific and cite the real numbers with sample sizes. Be encouraging but honest: say what is going well " +
  "and what to work on, with concrete practice suggestions when asked. " +
  "Write plain prose, no markdown headers, bold or bullet symbols. A few sentences for simple questions, " +
  "up to about 350 words for a detailed one. Finish your thought. " +
  "Format dates naturally like 'Tuesday, October 9th' and never as raw ISO timestamps. " +
  "If the data cannot answer the question, say so plainly and suggest what to log next.";

const TOOL_RULES =
  "TOOLS: you can call tools to dig deeper than the summary: query_games (filter games), get_stats (totals for any mode or date range), " +
  "head_to_head (record vs one opponent), analyze_game (dart by dart for one game), get_series (a metric over time, returns a chartable id). Use them whenever the question needs filtering, a date range, another player, " +
  "a specific game, or a chart the summary doesn't already have. Call several in one turn when they are independent. " +
  "Other players' data is only what the signed-in player can see (people they follow). Resolve 'today', 'this month' and similar from `today`.\n\n";

// The personal Blackbird AI tab: the signed-in player's own games, form,
// records, trends, practice and rivalries, with follow-up questions in
// context, tools for deeper questions, and up to three charts.
function buildPersonalPrompt(summary, question, history, { tools = false } = {}) {
  const name = summary?.me?.name || "the player";
  const seriesKeys = Object.keys(summary?.series || {});
  const system =
    `You are Blackbird AI, ${name}'s personal darts coach inside the Blackbird scoring app. ` +
    "You are talking directly to that player: say 'you' and 'your', never their name in the third person. " +
    "Use ONLY the JSON data provided and tool results; never invent stats, games, opponents or dates.\n\n" +
    "THE DATA: `me` has career totals per game type (X01, cricket, baseball and the party games). " +
    "`me.rankInCircle` and `me.circleSize` rank the player among their circle (themselves plus the players they follow), never a whole league; `me.circle` counts who they follow and who follows them. " +
    "`checkouts` has finishing stats replayed from every X01 dart log: checkout chances (darts thrown at a finish), " +
    "checkouts hit, checkout percentage, by range, highest and average finish, busts. " +
    "`scoring` has 100+, 140+ and 180 visits and per-dart-position averages. " +
    "`form` compares the last 10 games with the 10 before, and the last 30 days with the 30 before. " +
    "`trends.byMonth` and `trends.byWeek` are period tables (3-dart average, first-9, checkout %, win %, MPR, tons). " +
    "`series` holds the same trends as named point lists {x, y, date, label, n} where n is the sample size. " +
    "`careers` has career numbers for EVERY game mode the player has played (x01, cricket, baseball, aroundTheClock, killer, shanghai, halveit, gotcha, tictactoe and the drills bobs27, checkoutDrill, scoringDrill), each with a `coverage` block saying how many games had full dart logs. " +
    "`achievements` lists the badges the player has earned (with dates) and the badges closest to unlocking with their progress; mention a fresh badge or a close one when it fits. " +
    "`headToHead` is the full record against each opponent (see `definitions.headToHead`): overall and per game mode in `byGameType`, the streak and the last five meetings. " +
    "Match an opponent the player names case-insensitively against `headToHead[].opponent` or `.handle` (and `roster` for names and @handles); a first name or @handle is enough. " +
    "For 'my record/W-L vs X' questions quote wins-losses from `headToHead`, split by game mode when there is more than one, and mention otherWinner games separately. " +
    "`recentGames` is one row per recent game with its derived numbers, " +
    "and `practice` the drill log, solo X01 sessions and the bot ladder. " +
    "Checkout % is checkouts hit divided by checkout chances; a chance is one dart thrown while the remaining score could be finished with that dart. " +
    "When asked about a trend, read the monthly or weekly tables and quote the actual values and sample sizes; " +
    "with fewer than about 10 chances in a period say the sample is small. Null means no data for that period.\n\n" +
    (tools ? TOOL_RULES : "") +
    CHART_RULES +
    "Summary series keys available: " + (seriesKeys.length ? seriesKeys.join(", ") : "(none)") + ".\n\n" +
    STYLE_RULES;
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
  const q = (question || "").toString().slice(0, 600).trim();
  const data = tools ? slimSummary(summary) : summary;
  const user = `QUESTION: ${q}

DATA:
${JSON.stringify(data)}`;
  return { system, user, turns };
}

/**
 * With tools available the prompt carries headline numbers only; the model
 * fetches detail itself. Chart series stay resolvable server-side.
 */
function slimSummary(s) {
  if (!s) return s;
  const { series, careers, recentGames, trends, headToHead, practice, ...rest } = s;
  return {
    ...rest,
    trends: { byMonth: (trends?.byMonth || []).slice(-6) },
    headToHead: (headToHead || []).slice(0, 8).map(({ last5, byGameType, ...h }) => h),
    recentGames: (recentGames || []).slice(-8),
    practice: practice ? { sessions: practice.sessions, thisWeek: practice.thisWeek, bots: { games: practice.bots?.games, wins: practice.bots?.wins, ladderLevel: practice.bots?.ladderLevel } } : null,
  };
}

function buildGamePrompt(match, me) {
  const system =
    `You are Blackbird AI, ${me}'s darts coach. Write a short match report on ONE game for ${me}, talking to them as 'you'. ` +
    "Use ONLY the JSON data: the players' metrics, legs or rounds, and the visit-by-visit log (darts like T20, D16, S5, Miss). " +
    "Cover: the result and how it was decided, the key moments (big visits, the leg or round that swung it, busts), " +
    "finishing (checkout chances and hits, doubles missed) or the mode's equivalent, and one specific thing to practise. " +
    "If the game has no dart log, say only totals are known and keep it brief. About 150 to 250 words.\n\n" +
    "Then add ONE or TWO chart blocks using the ids in `chartableSeries` (use the ids array to compare players):\n" +
    "```chart\n{\"type\": \"line\", \"title\": \"Score per visit\", \"series\": [\"s1\", \"s2\"]}\n```\n" +
    "Only use ids listed there. " +
    STYLE_RULES;
  return { system, user: `GAME:\n${JSON.stringify(match)}` };
}

function buildWeeklyPrompt(week) {
  const system =
    `You are Blackbird AI, ${week.player}'s darts coach. Write this week's report card for ${week.player}, talking to them as 'you'. ` +
    "Use ONLY the JSON data: this week's totals against last week's, Elo change, opponents and each game. " +
    "Open with a one-line verdict on the week, then the highlights with real numbers, what slipped compared with last week " +
    "(only if previousWeek exists), and end with ONE concrete focus for next week. About 120 to 180 words.\n\n" +
    "Then add a stats block with 3 or 4 of the week's headline numbers, and at most one chart from `chartableSeries`:\n" +
    "```chart\n{\"type\": \"stats\", \"items\": [{\"label\": \"Games\", \"value\": \"6\"}, {\"label\": \"Win %\", \"value\": \"50%\"}]}\n```\n" +
    STYLE_RULES;
  return { system, user: `WEEK:\n${JSON.stringify(week)}` };
}

function buildPrompt(kind, summary, question) {
  const system =
    "You are a sharp darts analyst for a darts player and the people they follow. " +
    "Use ONLY the JSON data provided; never invent stats or names. " +
    "The data may include aggregate player stats AND individual game results " +
    "(with per-game stats like highestTurn, checkout, runs, mpr, dartsThrown, dates, opponents). " +
    "When answering questions about specific games, records, or events, reference " +
    "the individual game results and their dates. " +
    "Write plain prose (no markdown headers or bullet symbols), specific and " +
    "citing the real numbers. Be as thorough as the question needs: a few sentences " +
    "for simple asks, and a full, well-organized answer (up to ~500 words) for " +
    "complex or multi-part questions. Finish your thought — do not stop mid-sentence. " +
    "When mentioning dates or times, always format them in a natural, readable way " +
    "like 'Tuesday, October 9th, 2026 at 10:00 PM'. Never output raw ISO timestamps " +
    "or date strings like '2026-10-09T22:00:00.000Z'.";

  let task;
  if (kind === "custom") {
    const q = (question || "").toString().slice(0, 600).trim();
    task =
      `Answer this question about the league, using ONLY the data below. ` +
      `If the data can't answer it, say so plainly rather than guessing.\n\nQUESTION: ${q}`;
  } else if (kind === "player") {
    task =
      "Profile this player: strengths, weaknesses, current form, and one concrete thing to work on.";
  } else if (kind === "matchup") {
    task =
      "Preview this head-to-head: who is favoured and why, the key stat that decides it, and one X-factor.";
  } else {
    task =
      "Give a league overview: who is hot, the biggest surprise, the tightest rivalry, and a fun award or two.";
  }

  return { system, user: `${task}\n\nDATA:\n${JSON.stringify(summary)}` };
}

/** One plain model call (no tools). */
async function callAI({ system, user, turns = [] }) {
  const cfg = providerConfig();
  const out = await makeStep(cfg)({ system, messages: [...turns, { role: "user", content: user }], tools: null, final: true });
  return { text: out.text || "", model: out.model };
}

/** Every game_results row the signed-in user may read, through their own token (RLS applies). */
async function loadData(sUrl, sKey, token) {
  const sb = createClient(sUrl, sKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const [{ data: rows, error }, { data: players }] = await Promise.all([
    sb.from("game_results").select("*").order("completed_at", { ascending: true }),
    sb.from("players").select("username, handle"),
  ]);
  if (error) throw error;
  return { rows: (rows || []).map((r) => resultFromRow(r, BASE_ELO)), players: players || [] };
}

function friendlyError(e) {
  const msg = e?.message || "AI request failed";
  if (/_API_KEY is not set|Unknown AI_PROVIDER/.test(msg)) return { status: 503, error: "Blackbird AI isn't switched on yet. The site owner needs to add an AI provider key." };
  if (e?.quota) return { status: 429, error: "Blackbird AI has hit its free usage limit for now. Try again in a minute (or tomorrow if it keeps happening)." };
  return { status: 500, error: msg };
}

export async function POST(req) {
  // --- auth: require a valid Supabase session token ---
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !sUrl || !sKey) return jsonRes({ error: "Unauthorized" }, 401);
  const sb = createClient(sUrl, sKey);
  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData?.user) return jsonRes({ error: "Unauthorized" }, 401);

  // --- generate ---
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "Bad request" }, 400);
  }
  const { kind, summary, question, history, gameId, me: meName } = body || {};

  try {
    // one game's match report
    if (kind === "game") {
      if (!gameId || !meName) return jsonRes({ error: "Missing game" }, 400);
      const { rows, players } = await loadData(sUrl, sKey, token);
      const gameRows = rows.filter((r) => r.gameId === gameId);
      if (!gameRows.length) return jsonRes({ error: "That game isn't available." }, 404);
      const runner = createToolRunner({ rows, players, me: meName });
      const match = describeMatch(gameRows, runner.register);
      const { text: raw, model } = await callAI(buildGamePrompt(match, meName));
      const { text, charts } = extractCharts(raw);
      let resolved = resolveCharts(charts, runner.series, runner.heatmaps);
      // no usable chart from the model: draw the first series the game has
      if (!resolved.length && match.chartableSeries[0]) {
        const cs = match.chartableSeries[0];
        resolved = resolveCharts([{ type: "line", title: cs.metric === "visitScores" ? "Score per visit" : cs.metric, series: cs.ids, names: cs.players }], runner.series);
      }
      return jsonRes({ text: text || raw, charts: resolved, model });
    }

    // the weekly report card
    if (kind === "weekly") {
      if (!meName) return jsonRes({ error: "Missing player" }, 400);
      const { rows, players } = await loadData(sUrl, sKey, token);
      const runner = createToolRunner({ rows, players, me: meName });
      const week = weeklyData({ rows, me: meName, register: runner.register });
      if (!week) return jsonRes({ empty: true });
      const { text: raw, model } = await callAI(buildWeeklyPrompt(week));
      const { text, charts } = extractCharts(raw);
      return jsonRes({ text: text || raw, charts: resolveCharts(charts, runner.series, runner.heatmaps), from: week.from, to: week.to, model });
    }

    if (!summary) return jsonRes({ error: "Missing data" }, 400);
    if ((kind === "custom" || kind === "me") && !(question || "").toString().trim()) {
      return jsonRes({ error: "Type a question first." }, 400);
    }
    if (kind !== "me") {
      const { text: raw, model } = await callAI(buildPrompt(kind, summary, question));
      if (!raw.trim()) return jsonRes({ error: "The model returned an empty response." }, 502);
      return jsonRes({ text: raw, model });
    }

    // the personal coach: tools over the user's own visible rows, then up
    // to three charts resolved against the app's numbers
    const me = summary?.me?.name;
    let data = null;
    try {
      data = me ? await loadData(sUrl, sKey, token) : null;
    } catch {
      data = null; // no tools this time; the summary still answers
    }
    let raw = "";
    let model = "";
    let store = { ...(summary.series || {}) };
    let heatmaps = {};
    if (data) {
      const runner = createToolRunner({ rows: data.rows, players: data.players, me });
      const prompt = buildPersonalPrompt(summary, question, history, { tools: true });
      try {
        const out = await runAgent({
          system: prompt.system,
          messages: [...prompt.turns, { role: "user", content: prompt.user }],
          tools: TOOL_DEFS,
          step: makeStep(providerConfig()),
          runTool: (name, args) => runner.run(name, args),
        });
        raw = out.text;
        model = out.model;
        store = { ...store, ...runner.series };
        heatmaps = runner.heatmaps;
      } catch (e) {
        if (e?.quota || /_API_KEY is not set|Unknown AI_PROVIDER/.test(e?.message || "")) throw e;
        raw = ""; // tool calling failed: fall back to the plain summary path
      }
    }
    if (!raw.trim()) {
      const out = await callAI(buildPersonalPrompt(summary, question, history));
      raw = out.text;
      model = out.model;
    }
    if (!raw.trim()) return jsonRes({ error: "The model returned an empty response." }, 502);
    const { text, charts } = extractCharts(raw);
    const resolved = resolveCharts(charts, store, heatmaps);
    return jsonRes({ text: text || raw, charts: resolved, chart: resolved[0] || null, model });
  } catch (e) {
    const { status, error } = friendlyError(e);
    return jsonRes({ error }, status);
  }
}
