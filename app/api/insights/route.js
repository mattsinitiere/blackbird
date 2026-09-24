import { createClient } from "@supabase/supabase-js";
import { extractChart, resolveChart } from "@/lib/aiChart";

// Runs on the server only. The AI key lives in a non-public env var and is
// never sent to the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash", // free tier
  groq: "llama-3.3-70b-versatile", // free tier
  openai: "gpt-4o-mini", // paid
  anthropic: "claude-3-5-haiku-latest", // paid
};

function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The personal Blackbird AI tab: the signed-in player's own games, form,
// records, trends, practice and rivalries, with follow-up questions in
// context and an optional chart drawn from the app's own series.
function buildPersonalPrompt(summary, question, history) {
  const name = summary?.me?.name || "the player";
  const seriesKeys = Object.keys(summary?.series || {});
  const system =
    `You are Blackbird AI, ${name}'s personal darts coach inside the Blackbird scoring app. ` +
    "You are talking directly to that player: say 'you' and 'your', never their name in the third person. " +
    "Use ONLY the JSON data provided; never invent stats, games, opponents or dates.\n\n" +
    "THE DATA: `me` has career totals per game type (X01, cricket, baseball and the party games). " +
    "`me.rankInCircle` and `me.circleSize` rank the player among their circle (themselves plus the players they follow), never a whole league; `me.circle` counts who they follow and who follows them. " +
    "`checkouts` has finishing stats replayed from every X01 dart log: checkout chances (darts thrown at a finish), " +
    "checkouts hit, checkout percentage, by range, highest and average finish, busts. " +
    "`scoring` has 100+, 140+ and 180 visits and per-dart-position averages. " +
    "`form` compares the last 10 games with the 10 before, and the last 30 days with the 30 before. " +
    "`trends.byMonth` and `trends.byWeek` are period tables (3-dart average, first-9, checkout %, win %, MPR, tons). " +
    "`series` holds the same trends as named point lists {x, y, date, label, n} where n is the sample size. " +
    "`achievements` lists the badges the player has earned (with dates) and the badges closest to unlocking with their progress; mention a fresh badge or a close one when it fits. " +
    "`headToHead` is the record against each opponent, `recentGames` one row per recent game with its derived numbers, " +
    "and `practice` the drill log, solo X01 sessions and the bot ladder. " +
    "Checkout % is checkouts hit divided by checkout chances; a chance is one dart thrown while the remaining score could be finished with that dart. " +
    "When asked about a trend, read the monthly or weekly tables and quote the actual values and sample sizes; " +
    "with fewer than about 10 chances in a period say the sample is small. Null means no data for that period.\n\n" +
    "CHARTS: when a chart would help (any trend, comparison or 'show me' request, or when the player asks for a chart or graph), " +
    "append exactly one fenced block after your prose, on its own lines:\n" +
    "```chart\n{\"type\": \"line\", \"title\": \"Checkout % by month\", \"unit\": \"%\", \"decimals\": 1, \"series\": \"checkoutPctByMonth\"}\n```\n" +
    "`series` must be one of these keys from the data: " + (seriesKeys.length ? seriesKeys.join(", ") : "(none yet)") + ". " +
    "Add \"last\": N to show only the most recent N points. Use type \"bar\" for counts or comparisons. " +
    "For a comparison you computed yourself (for example wins per opponent), use \"points\": [{\"label\": \"Sam\", \"y\": 4}] instead of series, with numbers taken straight from the data. " +
    "Never put a chart block in the middle of a sentence, never send more than one, and never draw a chart of data that is not there. " +
    "The chart is rendered by the app, so do not describe it as attached or say you cannot draw.\n\n" +
    "STYLE: be specific and cite the real numbers. Be encouraging but honest: point out what is going well " +
    "and what to work on, with concrete practice suggestions when asked. " +
    "Write plain prose, no markdown headers, bold or bullet symbols. A few sentences for simple questions, " +
    "up to about 350 words for a detailed one. Finish your thought. " +
    "Format dates naturally like 'Tuesday, October 9th' and never as raw ISO timestamps. " +
    "If the data cannot answer the question, say so plainly and suggest what to log next.";
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
  const q = (question || "").toString().slice(0, 600).trim();
  const user = `QUESTION: ${q}

DATA:
${JSON.stringify(summary)}`;
  return { system, user, turns };
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

async function callAI({ system, user, turns = [] }) {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider];
  // earlier turns of the conversation, oldest first, then the new question
  const chat = [...turns, { role: "user", content: user }];

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: chat.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: {
            maxOutputTokens: 3000,
            temperature: 0.8,
            // gemini-2.5 spends output tokens on internal "thinking", which can
            // truncate the visible answer; turn it off so all tokens go to text
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "Gemini request failed");
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p) => p && p.text && !p.thought)
      .map((p) => p.text)
      .join("");
    return { text, model: `gemini/${model}` };
  }

  if (provider === "groq" || provider === "openai") {
    const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
    if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY is not set`);
    const base =
      provider === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : "https://api.openai.com/v1/chat/completions";
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        temperature: 0.8,
        messages: [{ role: "system", content: system }, ...chat],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `${provider} request failed`);
    return { text: data?.choices?.[0]?.message?.content || "", model: `${provider}/${model}` };
  }

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        system,
        messages: chat,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "Anthropic request failed");
    const text = (data?.content || []).map((b) => b.text || "").join("");
    return { text, model: `anthropic/${model}` };
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
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
  const { kind, summary, question, history } = body || {};
  if (!summary) return jsonRes({ error: "Missing data" }, 400);
  if ((kind === "custom" || kind === "me") && !(question || "").toString().trim()) {
    return jsonRes({ error: "Type a question first." }, 400);
  }

  try {
    const prompt = kind === "me" ? buildPersonalPrompt(summary, question, history) : buildPrompt(kind, summary, question);
    const { text: raw, model } = await callAI(prompt);
    if (!raw.trim()) return jsonRes({ error: "The model returned an empty response." }, 502);
    if (kind !== "me") return jsonRes({ text: raw, model });
    // the personal coach may append one chart block; resolve it against the
    // player's own series so the numbers drawn are the app's, not the model's
    const { text, chart } = extractChart(raw);
    const resolved = chart ? resolveChart(chart, summary.series) : null;
    return jsonRes({ text: text || raw, chart: resolved, model });
  } catch (e) {
    const msg = e.message || "AI request failed";
    // a missing provider key is a setup problem, not a user problem
    const setup = /_API_KEY is not set|Unknown AI_PROVIDER/.test(msg);
    return jsonRes({ error: setup ? "Blackbird AI isn't switched on yet. The site owner needs to add an AI provider key." : msg }, setup ? 503 : 500);
  }
}
