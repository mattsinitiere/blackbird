import { rivalry } from "./stats.js";
import { nextUp } from "./achievements.js";
import { isBot } from "./bots.js";

/**
 * The Home welcome card: a time-of-day greeting and one insight line
 * drawn from the player's real data. Pure: the caller supplies `now`, the
 * previous visit time and which insight was shown last, so the pick can
 * rotate between app opens without repeating. Each insight appears only
 * when its data exists.
 */

const DAY = 86400000;

export function greeting(name, now = new Date(), lastVisit = null) {
  const first = String(name || "").split(" ")[0] || "there";
  if (lastVisit && now - new Date(lastVisit) >= 3 * DAY) return `Welcome back, ${first}`;
  const h = now.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${first}`;
}

function formInsight(s) {
  if (!s || !s.games) return null;
  if (s.winStreak >= 2) return { kind: "form", text: `You're on a ${s.winStreak}-game win streak. Keep it going.` };
  const last = s.lastFive || [];
  if (last.length >= 3) return { kind: "form", text: `Last ${last.length}: ${last.join(" ")}`, form: last };
  return null;
}

function rivalInsight(results, me) {
  const mine = (results || []).filter((r) => r.username === me && r.result !== "practice");
  const counts = {};
  for (const r of mine) for (const o of r.opponents || []) if (!isBot(o)) counts[o] = (counts[o] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 3) return null;
  const rv = rivalry(results, me, top[0]);
  const opp = top[0];
  const text =
    rv.losses > rv.wins
      ? `${opp} leads you ${rv.losses}–${rv.wins}. Time for a rematch?`
      : rv.wins > rv.losses
      ? `You lead ${opp} ${rv.wins}–${rv.losses}. Keep it that way?`
      : `You and ${opp} are level at ${rv.wins}–${rv.losses}. Settle it?`;
  return { kind: "rival", text, opponent: opp };
}

function badgeInsight(badges) {
  // Elo targets read oddly as "N to go" and would win every time; skip them
  const b = nextUp((badges || []).filter((x) => !String(x.id).startsWith("elo_")), 1)[0];
  if (!b) return null;
  const left = b.progress.target - b.progress.value;
  return { kind: "badge", text: `${left} to go for ${b.title} (${b.progress.value}/${b.progress.target})`, badge: b };
}

function sinceInsight({ results, me, following, lastVisit, now }) {
  if (lastVisit) {
    const since = new Date(lastVisit);
    const games = {};
    for (const r of results || []) {
      if (r.username === me || !following.includes(r.username)) continue;
      if (new Date(r.completedAt) <= since) continue;
      (games[r.username] = games[r.username] || new Set()).add(r.gameId);
    }
    const top = Object.entries(games).sort((a, b) => b[1].size - a[1].size)[0];
    if (top) return { kind: "since", text: `${top[0]} played ${top[1].size} ${top[1].size === 1 ? "game" : "games"} since you were last here.` };
  }
  // otherwise: my Elo over the last 7 days
  const mine = (results || []).filter((r) => r.username === me && r.result !== "practice").sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const cut = now - 7 * DAY;
  const before = mine.filter((r) => new Date(r.completedAt) < cut).slice(-1)[0];
  const week = mine.filter((r) => new Date(r.completedAt) >= cut);
  if (!week.length) return null;
  const start = before ? before.eloAfter : 1000;
  const delta = Math.round(week[week.length - 1].eloAfter - start);
  if (!delta) return null;
  return { kind: "since", text: `Your Elo is ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} this week.` };
}

/** Every insight with real data behind it. */
export function welcomeInsights({ me, stats, results, badges, following = [], lastVisit = null, now = new Date() }) {
  return [formInsight(stats?.[me]), rivalInsight(results, me), badgeInsight(badges), sinceInsight({ results, me, following, lastVisit, now })].filter(Boolean);
}

/** Pick one, avoiding the kind shown last time when there is a choice. */
export function pickInsight(insights, lastKind = null, rand = Math.random) {
  if (!insights.length) return null;
  const pool = insights.length > 1 ? insights.filter((i) => i.kind !== lastKind) : insights;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
