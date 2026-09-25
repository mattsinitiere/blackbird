import { searchPlayers } from "./follows.js";
import { GAME_MODES, gameName, gameTitle } from "./summary.js";
import { playerLabel } from "./bots.js";
import { GOALS } from "./trainingPlans.js";

/**
 * Home search: players, game modes and the signed-in player's own previous
 * matches, from data already on the device. Pure.
 *   players: name or @handle (lib/follows.js searchPlayers; no bots, no
 *            hidden players, not yourself)
 *   modes:   game names ("crick" finds Cricket, "bob" finds Bob's 27)
 *   matches: your games only, one per game id, newest first; every word of
 *            the query must match the mode, an opponent (name, @handle or
 *            bot name), the result (win, loss, practice) or the date
 *            ("sep", "sep 12", "2026")
 *   achievements: your badges by title, description or category
 *            ("unlocked" / "locked" narrow them)
 *   plans:   your saved training plans by title or goal
 */

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9@]+/g, " ").trim();
const DATE_FMT = { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" };

function dateWords(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  const short = new Intl.DateTimeFormat("en-US", DATE_FMT).format(d); // "Sep 12, 2026"
  const long = new Intl.DateTimeFormat("en-US", { ...DATE_FMT, month: "long", weekday: "long" }).format(d); // "Saturday, September 12, 2026"
  return norm(`${short} ${long}`);
}

function resultWords(r) {
  if (r.result === "practice") return "practice";
  if (r.result === "win") return "win won victory";
  if (r.result === "loss") return "loss lost defeat";
  return norm(r.result);
}

/** One row per game the player played, newest first. */
export function myMatches(results, me) {
  const seen = new Set();
  return (results || [])
    .filter((r) => r && r.username === me && r.gameId)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .filter((r) => (seen.has(r.gameId) ? false : seen.add(r.gameId)));
}

const goalLabel = (id) => GOALS.find((g) => g.id === id)?.label || "";

export function searchAll({ query, players = [], results = [], me = null, achievements = [], plans = [], limit = 50 } = {}) {
  const q = norm(query).replace(/^@+/, "");
  const matches = myMatches(results, me);
  if (!q) return { query: "", players: [], modes: GAME_MODES.map((id) => ({ id, name: gameName(id), games: matches.filter((m) => m.gameType === id).length })), matches: matches.slice(0, 5), achievements: [], plans: [] };

  const handleOf = new Map((players || []).map((p) => [p.username, p.handle || ""]));
  const foundPlayers = searchPlayers((players || []).filter((p) => !p.hidden), q, { exclude: me ? [me] : [], limit });

  const modes = GAME_MODES.map((id) => ({ id, name: gameName(id), games: matches.filter((m) => m.gameType === id).length })).filter(
    (m) => norm(m.name).includes(q) || norm(m.name).replace(/ /g, "").includes(q.replace(/ /g, "")) || m.id.toLowerCase().includes(q.replace(/ /g, ""))
  );

  const words = q.split(" ").filter(Boolean);
  const hay = (r) =>
    norm(
      [
        gameName(r.gameType),
        gameTitle(r.gameType, r.config || {}),
        ...(r.opponents || []).map((o) => `${o} ${playerLabel(o)} ${handleOf.get(o) || ""}`),
        resultWords(r),
        dateWords(r.completedAt),
      ].join(" ")
    );
  const foundMatches = matches.filter((r) => {
    const h = hay(r);
    return words.every((w) => h.includes(w));
  });

  // word prefixes, so "locked" doesn't match "unlocked"
  const every = (text) => {
    const hw = norm(text).split(" ");
    return words.every((w) => hw.some((h) => h.startsWith(w)));
  };
  // unlocked first (newest first), then locked by progress
  const pct = (a) => (a.progress?.target ? a.progress.value / a.progress.target : 0);
  const foundAchievements = (achievements || [])
    .filter((a) => a && every(`${a.title} ${a.description || ""} ${a.category || ""} ${a.unlocked ? "unlocked earned" : "locked"}`))
    .sort((a, b) => (a.unlocked !== b.unlocked ? (a.unlocked ? -1 : 1) : a.unlocked ? String(b.earnedAt).localeCompare(String(a.earnedAt)) : pct(b) - pct(a)));

  const foundPlans = (plans || []).filter((p) => p?.definition && every(`${p.definition.title} ${goalLabel(p.definition.goal)} ${p.definition.goal} plan training`));

  return { query: q, players: foundPlayers, modes, matches: foundMatches.slice(0, limit), achievements: foundAchievements.slice(0, limit), plans: foundPlans };
}
