import { extractCharts } from "./aiChart.js";
import { SCORING_TARGETS, SCORING_TURNS } from "./drills.js";
import { BOTS } from "./bots.js";

/**
 * Everything Blackbird AI may append after its prose, as fenced blocks:
 *   ```chart      up to three charts (lib/aiChart.js)
 *   ```followups  ["question", ...]  up to three tappable follow-ups
 *   ```actions    [{ type, gameType, config, label }]  practice to start
 * Actions are checked against what the app can actually launch, with
 * settings snapped to real options, so a model can't invent a game. Pure.
 */

// two or three backticks, JSON on the same line or the next (see lib/aiChart.js)
const FENCE = /`{2,3}[ \t]*(followups|actions)[ \t]*\r?\n?([\s\S]*?)`{2,3}/g;
const MAX_FOLLOWUPS = 3;
const MAX_ACTIONS = 3;
const nearest = (v, options, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return options.reduce((best, o) => (Math.abs(o - n) < Math.abs(best - n) ? o : best), options[0]);
};
const DRILL_NAMES = { checkoutDrill: "Checkout Drill", scoringDrill: "Scoring Drill", bobs27: "Bob's 27" };

/** One action, validated and normalised, or null. */
export function validateAction(a) {
  if (!a || typeof a !== "object") return null;
  const label = (s) => String(s || "").trim().slice(0, 44);
  if (a.type === "bot") {
    const bot = BOTS.find((b) => b.id === a.bot || b.name.toLowerCase() === String(a.bot || "").toLowerCase());
    if (!bot) return null;
    const gameType = a.gameType === "cricket" ? "cricket" : "x01";
    return { type: "bot", bot: bot.id, gameType, label: label(a.label) || `Play ${bot.name}` };
  }
  const gameType = a.gameType;
  if (gameType === "checkoutDrill") {
    const count = nearest(a.config?.count, [5, 10, 20], 10);
    return { type: "drill", gameType, config: { count }, label: label(a.label) || `Checkout Drill · ${count} finishes` };
  }
  if (gameType === "scoringDrill") {
    const target = nearest(a.config?.target === "bull" ? 25 : a.config?.target, SCORING_TARGETS, 20);
    const turns = nearest(a.config?.turns, SCORING_TURNS, 10);
    return { type: "drill", gameType, config: { target, turns }, label: label(a.label) || `Scoring Drill · ${target === 25 ? "Bull" : target}s × ${turns}` };
  }
  if (gameType === "bobs27") return { type: "drill", gameType, config: {}, label: label(a.label) || DRILL_NAMES.bobs27 };
  if (gameType === "x01") {
    const startScore = nearest(a.config?.startScore, [301, 501, 701], 501);
    const doubleOut = a.config?.doubleOut !== false;
    return { type: "drill", gameType, config: { startScore, doubleOut, legs: 1 }, label: label(a.label) || `Solo ${startScore}` };
  }
  return null;
}

function parse(raw) {
  try {
    return JSON.parse(String(raw).trim());
  } catch {
    return null;
  }
}

/** Split a reply into prose, charts, follow-ups and actions. */
export function extractBlocks(text) {
  let followups = [];
  let actions = [];
  const rest = String(text || "").replace(FENCE, (m, kind, body) => {
    const v = parse(body);
    const list = Array.isArray(v) ? v : Array.isArray(v?.[kind]) ? v[kind] : [];
    if (kind === "followups") {
      followups = list
        .filter((q) => typeof q === "string" && q.trim())
        .map((q) => q.trim().slice(0, 80))
        .slice(0, MAX_FOLLOWUPS);
    } else {
      actions = list.map(validateAction).filter(Boolean).slice(0, MAX_ACTIONS);
    }
    return "";
  });
  const { text: clean, charts } = extractCharts(rest);
  return { text: clean, charts, followups, actions };
}

/** While a reply streams in, hide any block that has started but not finished. */
export function visibleWhileStreaming(text) {
  const s = String(text || "");
  const i = s.indexOf("``"); // a block is starting (two or three backticks)
  return (i === -1 ? s : s.slice(0, i)).trimEnd();
}
