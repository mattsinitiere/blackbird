import { computeStats } from "./stats.js";
import { computePractice, PRACTICE_ONLY } from "./practice.js";
import { isBot, BOTS } from "./bots.js";
import { analyzeGame } from "./gamestats/index.js";

/**
 * Achievements are derived from history, never stored: every badge has a
 * `test(ctx)` that returns when it was earned (the date of the game that
 * earned it) and, for counting badges, the progress so far. That keeps
 * badges always correct and lets them unlock retroactively. Badges marked
 * `selfOnly` need the player's own follows and are only computed with a
 * `social` object. `icon` names a vector icon in lib/icons.js. Pure.
 */

const day = (iso) => iso || null;

function buildContext({ me, results, practice, social, now }) {
  const rows = (results || [])
    .filter((r) => r.username === me && r.result !== "practice")
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const games = rows.map((row) => ({ row, date: row.completedAt, won: row.winner === me, a: analyzeGame(row) }));
  const practiceRows = (practice || [])
    .filter((r) => r.username === me)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const drills = practiceRows.map((row) => ({ row, date: row.completedAt, won: row.winner === me, a: analyzeGame(row) }));
  const stats = computeStats(results || [])[me] || null;
  // every game of any kind, oldest first (Warm Up)
  const everything = [...games, ...drills].sort((a, b) => new Date(a.date) - new Date(b.date));
  // the player's own app activity (days they opened the app, when they first
  // customised each part of their profile); only present for yourself
  const activity = social?.activity || null;
  return { me, rows, games, drills, everything, practiceRows, stats, social, activity, now: now || new Date() };
}

// ---- helpers for one-line definitions ----
export function firstBadge(list, pred) {
  const hit = (list || []).find(pred);
  return { earnedAt: hit ? day(hit.date) : null };
}

export function countBadge(list, pred, target) {
  let n = 0;
  let earnedAt = null;
  for (const g of list || []) {
    if (!pred(g)) continue;
    n++;
    if (n === target && !earnedAt) earnedAt = day(g.date);
  }
  return { earnedAt, progress: { value: Math.min(n, target), target, kind: "count" } };
}

export function sumBadge(list, valueOf, target) {
  let total = 0;
  let earnedAt = null;
  for (const g of list || []) {
    total += valueOf(g) || 0;
    if (total >= target && !earnedAt) earnedAt = day(g.date);
  }
  return { earnedAt, progress: { value: Math.min(total, target), target, kind: "count" } };
}

export function maxBadge(list, valueOf, target, base = 0) {
  let best = 0;
  let earnedAt = null;
  for (const g of list || []) {
    const v = valueOf(g) || 0;
    if (v > best) best = v;
    if (v >= target && !earnedAt) earnedAt = day(g.date);
  }
  // a single-game record: progress is the best so far, not "N to go"
  return { earnedAt, progress: { value: Math.min(best, target), target, kind: "best", ...(base ? { base } : {}) } };
}

/**
 * Streak badges show the CURRENT run (a streak you broke doesn't count
 * toward the next one), plus the best run for context.
 */
export function streakBadge(games, target) {
  let run = 0;
  let best = 0;
  let earnedAt = null;
  for (const g of games || []) {
    run = g.won ? run + 1 : 0;
    if (run > best) best = run;
    if (run === target && !earnedAt) earnedAt = day(g.date);
  }
  return { earnedAt, progress: { value: Math.min(run, target), target, kind: "streak", best: Math.min(best, target) } };
}

/** Local calendar day, YYYY-MM-DD. */
export function localDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dayNum = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/**
 * Consecutive days the app was opened. The run still counts today if the
 * last visit was yesterday (today's visit may not be logged yet).
 */
export function dayStreakBadge(days, target, now = new Date()) {
  const list = [...new Set((days || []).filter(Boolean))].sort();
  let run = 0;
  let best = 0;
  let prev = null;
  let earnedAt = null;
  for (const k of list) {
    const n = dayNum(k);
    run = prev != null && n === prev + 1 ? run + 1 : 1;
    prev = n;
    if (run > best) best = run;
    if (run === target && !earnedAt) earnedAt = k;
  }
  const today = dayNum(localDay(now));
  const current = prev != null && today - prev <= 1 ? run : 0;
  return { earnedAt, progress: { value: Math.min(current, target), target, kind: "streak", best: Math.min(best, target) } };
}

const PROFILE_PARTS = ["color", "cover", "bio", "location", "tag", "handle"];

const x01 = (g) => g.row.gameType === "x01";
const cricket = (g) => g.row.gameType === "cricket";
const m = (g, k) => (g.a && g.a.metrics ? g.a.metrics[k] : null) ?? 0;
const one80s = (g) => (x01(g) ? Math.max(m(g, "one80s") || 0, g.row.stats?.highestTurn === 180 ? 1 : 0) : 0);
const topBot = BOTS[BOTS.length - 1]?.id;

/**
 * Every X01 leg this player won in a game: { checkout, lastDart }. Uses the
 * per-leg analysis (so a leg won in a lost best-of match still counts),
 * falling back to the match-level fields on rows without a visit log.
 */
function legsWon(g) {
  if (!x01(g)) return [];
  const a = g.a || {};
  const legs = (a.rounds || []).filter((l) => l.won && (l.checkout || 0) > 0);
  if (a.quality?.hasVisits && legs.length) {
    return legs.map((l) => {
      const lv = (a.visits || []).filter((v) => (v.r || 0) === l.r && v.out?.k !== "bust");
      const last = lv[lv.length - 1];
      const d = last?.darts?.[last.darts.length - 1] || null;
      return { checkout: l.checkout, lastDart: d };
    });
  }
  if (!g.won || !((g.row.stats?.checkout || 0) > 0)) return [];
  const darts = g.row.stats?.darts;
  return [{ checkout: g.row.stats.checkout, lastDart: Array.isArray(darts) && darts.length ? darts[darts.length - 1] : null }];
}
const bestCheckout = (g) => Math.max(0, ...legsWon(g).map((l) => l.checkout || 0));
const nthDate = (list, n) => (list && list.length >= n ? day(list[n - 1].createdAt) : null);

export const ACHIEVEMENTS = [
  // ---- milestones ----
  { id: "first_game", category: "Milestones", title: "First Blood", description: "Play your first ranked game.", icon: "dart", test: (c) => firstBadge(c.games, () => true) },
  { id: "games_10", category: "Milestones", title: "Regular", description: "Play 10 ranked games.", icon: "flag", tier: 1, test: (c) => countBadge(c.games, () => true, 10) },
  { id: "games_50", category: "Milestones", title: "Fixture", description: "Play 50 ranked games.", icon: "calendar", tier: 2, test: (c) => countBadge(c.games, () => true, 50) },
  { id: "games_200", category: "Milestones", title: "Lifer", description: "Play 200 ranked games.", icon: "landmark", tier: 3, test: (c) => countBadge(c.games, () => true, 200) },
  { id: "first_win", category: "Milestones", title: "On the Board", description: "Win a ranked game.", icon: "trophy", test: (c) => firstBadge(c.games, (g) => g.won) },
  { id: "wins_25", category: "Milestones", title: "Winner", description: "Win 25 ranked games.", icon: "medal", test: (c) => countBadge(c.games, (g) => g.won, 25) },
  { id: "elo_1100", category: "Milestones", title: "Climber", description: "Reach an Elo of 1100.", icon: "trendUp", test: (c) => maxBadge(c.games, (g) => g.row.eloAfter || 0, 1100, 1000) },
  // ---- scoring ----
  { id: "ton_up", category: "Scoring", title: "Ton Up", description: "Score 100 or more in a visit in a ranked X01 game.", icon: "gauge", test: (c) => firstBadge(c.games, (g) => x01(g) && ((m(g, "tons") || 0) >= 1 || (g.row.stats?.highestTurn || 0) >= 100)) },
  { id: "ton_40", category: "Scoring", title: "140 Club", description: "Score 140 or more in a visit in a ranked X01 game.", icon: "flame", test: (c) => firstBadge(c.games, (g) => x01(g) && ((m(g, "ton40s") || 0) >= 1 || (g.row.stats?.highestTurn || 0) >= 140)) },
  { id: "one_eighty", category: "Scoring", title: "Maximum", description: "Hit a 180 in a ranked X01 game.", icon: "burst", test: (c) => firstBadge(c.games, (g) => one80s(g) >= 1) },
  { id: "one_eighty_10", category: "Scoring", title: "Ten Maximums", description: "Hit ten 180s in ranked games.", icon: "firework", test: (c) => sumBadge(c.games, one80s, 10) },
  { id: "avg_60", category: "Scoring", title: "Sixty Average", description: "Average 60+ per three darts over a whole ranked X01 game (at least 9 darts).", icon: "bars", test: (c) => maxBadge(c.games, (g) => (x01(g) && (g.a?.totals?.dartsThrown || g.row.stats?.dartsThrown || 0) >= 9 ? m(g, "threeDartAvg") : 0), 60) },
  // ---- finishing ----
  { id: "first_checkout", category: "Finishing", title: "Closer", description: "Win a leg of ranked X01 on a checkout.", icon: "lock", test: (c) => firstBadge(c.games, (g) => legsWon(g).length > 0) },
  { id: "checkout_100", category: "Finishing", title: "Ton-Plus Finish", description: "Check out from 100 or more in ranked X01.", icon: "impact", test: (c) => maxBadge(c.games, bestCheckout, 100) },
  { id: "checkout_170", category: "Finishing", title: "Big Fish", description: "Check out 170 in ranked X01.", icon: "fish", test: (c) => firstBadge(c.games, (g) => legsWon(g).some((l) => l.checkout === 170)) },
  { id: "bull_finish", category: "Finishing", title: "Bullseye", description: "Finish a ranked X01 leg on the bull.", icon: "crosshair", test: (c) => firstBadge(c.games, (g) => legsWon(g).some((l) => l.lastDart && l.lastDart.n === 25 && l.lastDart.mult === 2)) },
  { id: "short_leg", category: "Finishing", title: "Eighteen Darter", description: "Win a ranked 501 leg in 18 darts or fewer.", icon: "stopwatch", test: (c) => firstBadge(c.games, (g) => x01(g) && (g.row.config?.startScore || 0) === 501 && (m(g, "bestLeg") ? m(g, "bestLeg") <= 18 : g.won && (g.row.stats?.dartsThrown || 999) <= 18)) },
  // ---- cricket ----
  { id: "cricket_first_win", category: "Cricket", title: "Closed Out", description: "Win a ranked game of Cricket.", icon: "wicket", test: (c) => firstBadge(c.games, (g) => cricket(g) && g.won) },
  { id: "mpr_3", category: "Cricket", title: "Three Marks", description: "Average 3+ marks per round over a ranked Cricket game (at least 5 rounds).", icon: "triple", test: (c) => maxBadge(c.games, (g) => (cricket(g) && (m(g, "rounds") || g.row.stats?.rounds || 0) >= 5 ? m(g, "mpr") : 0), 3) },
  // ---- streaks ----
  { id: "streak_3", category: "Streaks", title: "Hat-trick", description: "Win three ranked games in a row.", icon: "tophat", test: (c) => streakBadge(c.games, 3) },
  { id: "streak_7", category: "Streaks", title: "Untouchable", description: "Win seven ranked games in a row.", icon: "shield", test: (c) => streakBadge(c.games, 7) },
  { id: "comeback", category: "Streaks", title: "Bounce Back", description: "Win right after losing three in a row.", icon: "comeback", test: (c) => { let losses = 0; for (const g of c.games) { if (g.won) { if (losses >= 3) return { earnedAt: day(g.date) }; losses = 0; } else losses++; } return { earnedAt: null }; } },
  // ---- social ----
  { id: "rivalry_10", category: "Social", title: "Rivalry", description: "Play the same opponent 10 times.", icon: "swords", test: (c) => { const n = {}; let earnedAt = null; let best = 0; for (const g of c.games) { for (const o of g.row.opponents || []) { if (isBot(o)) continue; n[o] = (n[o] || 0) + 1; if (n[o] > best) best = n[o]; if (n[o] === 10 && !earnedAt) earnedAt = day(g.date); } } return { earnedAt, progress: { value: Math.min(best, 10), target: 10, kind: "count" } }; } },
  { id: "first_follow", category: "Social", title: "Wingman", description: "Follow another player.", icon: "userPlus", selfOnly: true, test: (c) => ({ earnedAt: nthDate(c.social?.following, 1) }) },
  { id: "crew_5", category: "Social", title: "Crew", description: "Follow five players.", icon: "users", selfOnly: true, test: (c) => ({ earnedAt: nthDate(c.social?.following, 5), progress: { value: Math.min(c.social?.following?.length || 0, 5), target: 5, kind: "count" } }) },
  { id: "popular_5", category: "Social", title: "Crowd Favourite", description: "Be followed by five players.", icon: "heart", selfOnly: true, test: (c) => ({ earnedAt: nthDate(c.social?.followers, 5), progress: { value: Math.min(c.social?.followers?.length || 0, 5), target: 5, kind: "count" } }) },
  // ---- practice ----
  { id: "first_drill", category: "Practice", title: "Homework", description: "Complete a practice drill.", icon: "book", test: (c) => firstBadge(c.drills, (g) => PRACTICE_ONLY.has(g.row.gameType)) },
  { id: "bot_slayer", category: "Practice", title: "Bot Slayer", description: "Beat a bot.", icon: "robot", test: (c) => firstBadge(c.drills, (g) => g.won && (g.row.opponents || []).some(isBot)) },
  { id: "ladder_top", category: "Practice", title: "Top of the Ladder", description: `Beat ${BOTS[BOTS.length - 1]?.name || "the top bot"}, the last bot on the ladder.`, icon: "ladder", test: (c) => { const pr = computePractice(c.practiceRows, c.me, c.now); const level = pr.bots.ladder.filter((l) => l.unlocked).length; const hit = c.drills.find((g) => g.won && (g.row.opponents || []).includes(topBot)); return { earnedAt: hit ? day(hit.date) : null, progress: { value: level, target: BOTS.length, kind: "count" } }; } },
  { id: "bobs27_clean", category: "Practice", title: "Clean 27", description: "Finish Bob's 27 without busting.", icon: "seal", test: (c) => firstBadge(c.drills, (g) => g.row.gameType === "bobs27" && !g.row.stats?.busted && (g.row.stats?.roundsCompleted || 0) >= 21) },

  // ---- more milestones ----
  { id: "warm_up", category: "Milestones", title: "Warm Up", description: "Finish your first game of any kind (practice counts).", icon: "sparkles", test: (c) => firstBadge(c.everything, () => true) },
  { id: "games_100", category: "Milestones", title: "Centurion", description: "Play 100 ranked games.", icon: "calendarGrid", tier: 2, test: (c) => countBadge(c.games, () => true, 100) },
  { id: "wins_100", category: "Milestones", title: "Champion", description: "Win 100 ranked games.", icon: "laurel", tier: 3, test: (c) => countBadge(c.games, (g) => g.won, 100) },
  { id: "elo_1200", category: "Milestones", title: "Elite", description: "Reach an Elo of 1200.", icon: "trendUp", tier: 3, test: (c) => maxBadge(c.games, (g) => g.row.eloAfter || 0, 1200, 1000) },
  // ---- more streaks ----
  { id: "redemption", category: "Streaks", title: "Redemption Arc", description: "Win three in a row straight after losing three or more in a row.", icon: "comeback", tier: 2, test: (c) => { let losses = 0; let wins = 0; let armed = false; for (const g of c.games) { if (g.won) { if (losses >= 3) armed = true; losses = 0; if (armed) { wins++; if (wins === 3) return { earnedAt: day(g.date) }; } } else { if (armed) { armed = false; wins = 0; } losses++; } } return { earnedAt: null }; } },
  { id: "rival_slayer", category: "Streaks", title: "Rival Slayer", description: "Beat the same opponent 10 times in ranked games.", icon: "swords", tier: 2, test: (c) => { const n = {}; let best = 0; let earnedAt = null; for (const g of c.games) { if (!g.won) continue; for (const o of g.row.opponents || []) { if (isBot(o)) continue; n[o] = (n[o] || 0) + 1; if (n[o] > best) best = n[o]; if (n[o] === 10 && !earnedAt) earnedAt = day(g.date); } } return { earnedAt, progress: { value: Math.min(best, 10), target: 10, kind: "count" } }; } },
  // ---- dedication: opening the app day after day ----
  { id: "days_3", category: "Dedication", title: "Warming Up", description: "Open Blackbird three days in a row.", icon: "flame", selfOnly: true, test: (c) => dayStreakBadge(c.activity?.visitDays, 3, c.now) },
  { id: "days_7", category: "Dedication", title: "Week Streak", description: "Open Blackbird seven days in a row.", icon: "calendar", selfOnly: true, tier: 1, test: (c) => dayStreakBadge(c.activity?.visitDays, 7, c.now) },
  { id: "days_30", category: "Dedication", title: "Month of Darts", description: "Open Blackbird 30 days in a row.", icon: "calendarGrid", selfOnly: true, tier: 2, test: (c) => dayStreakBadge(c.activity?.visitDays, 30, c.now) },
  { id: "days_90", category: "Dedication", title: "Season Ticket", description: "Open Blackbird 90 days in a row.", icon: "hourglass", selfOnly: true, tier: 3, test: (c) => dayStreakBadge(c.activity?.visitDays, 90, c.now) },
  { id: "days_365", category: "Dedication", title: "Year-Rounder", description: "Open Blackbird every day for a year.", icon: "laurel", selfOnly: true, tier: 3, test: (c) => dayStreakBadge(c.activity?.visitDays, 365, c.now) },
  { id: "play_days_20", category: "Dedication", title: "Dedicated", description: "Play ranked games on 20 different days.", icon: "runner", tier: 1, test: (c) => { const seen = new Set(); let earnedAt = null; for (const g of c.games) { seen.add(localDay(g.date)); if (seen.size === 20 && !earnedAt) earnedAt = day(g.date); } return { earnedAt, progress: { value: Math.min(seen.size, 20), target: 20, kind: "count" } }; } },
  { id: "marathon", category: "Dedication", title: "Marathon", description: "Play 10 ranked games in one day.", icon: "stopwatch", tier: 2, test: (c) => { const n = {}; let best = 0; let earnedAt = null; for (const g of c.games) { const k = localDay(g.date); n[k] = (n[k] || 0) + 1; if (n[k] > best) best = n[k]; if (n[k] === 10 && !earnedAt) earnedAt = day(g.date); } return { earnedAt, progress: { value: Math.min(best, 10), target: 10, kind: "best" } }; } },
  // ---- profile ----
  { id: "fresh_paint", category: "Profile", title: "Fresh Paint", description: "Pick your own player colour.", icon: "palette", selfOnly: true, test: (c) => ({ earnedAt: c.activity?.profile?.color || null }) },
  { id: "cover_story", category: "Profile", title: "Cover Story", description: "Choose a profile cover.", icon: "picture", selfOnly: true, test: (c) => ({ earnedAt: c.activity?.profile?.cover || null }) },
  { id: "about_me", category: "Profile", title: "About Me", description: "Write a bio.", icon: "pencil", selfOnly: true, test: (c) => ({ earnedAt: c.activity?.profile?.bio || null }) },
  { id: "name_tag", category: "Profile", title: "Name Tag", description: "Set a name tag.", icon: "tagShape", selfOnly: true, test: (c) => ({ earnedAt: c.activity?.profile?.tag || null }) },
  { id: "fully_loaded", category: "Profile", title: "Fully Loaded", description: "Set your colour, cover, bio, location, name tag and @handle.", icon: "idCard", selfOnly: true, tier: 1, test: (c) => { const p = c.activity?.profile || {}; const done = PROFILE_PARTS.filter((k) => p[k]); const earnedAt = done.length === PROFILE_PARTS.length ? done.map((k) => p[k]).sort().slice(-1)[0] : null; return { earnedAt, progress: { value: done.length, target: PROFILE_PARTS.length, kind: "count" } }; } },
  // ---- fun ----
  { id: "night_owl", category: "Fun", title: "Night Owl", description: "Finish a ranked game between midnight and 4 a.m.", icon: "moon", test: (c) => firstBadge(c.games, (g) => new Date(g.date).getHours() < 4) },
  { id: "early_bird", category: "Fun", title: "Early Bird", description: "Finish a ranked game between 5 and 9 a.m.", icon: "sunrise", test: (c) => firstBadge(c.games, (g) => { const h = new Date(g.date).getHours(); return h >= 5 && h < 9; }) },
  { id: "weekend_warrior", category: "Fun", title: "Weekend Warrior", description: "Play ranked games on a Saturday and the Sunday after it.", icon: "sun", test: (c) => { const sats = new Set(); for (const g of c.games) { const d = new Date(g.date); if (d.getDay() === 6) sats.add(dayNum(localDay(g.date))); if (d.getDay() === 0 && sats.has(dayNum(localDay(g.date)) - 1)) return { earnedAt: day(g.date) }; } return { earnedAt: null }; } },
  { id: "social_butterfly", category: "Fun", title: "Social Butterfly", description: "Play ranked games against five different opponents.", icon: "users", test: (c) => { const seen = new Set(); let earnedAt = null; for (const g of c.games) { for (const o of g.row.opponents || []) if (!isBot(o)) seen.add(o); if (seen.size >= 5 && !earnedAt) earnedAt = day(g.date); } return { earnedAt, progress: { value: Math.min(seen.size, 5), target: 5, kind: "count" } }; } },
  // ---- game modes ----
  { id: "home_run_derby", category: "Game Modes", title: "Home Run Derby", description: "Score 20 or more runs in a ranked Baseball game.", icon: "baseball", tier: 2, test: (c) => maxBadge(c.games, (g) => (g.row.gameType === "baseball" ? m(g, "runs") || g.row.stats?.runs || 0 : 0), 20) },
  { id: "grand_slam", category: "Game Modes", title: "Grand Slam", description: "Score 9 runs in one Baseball inning (three trebles).", icon: "baseball", tier: 3, test: (c) => maxBadge(c.games, (g) => (g.row.gameType === "baseball" ? m(g, "biggestInning") : 0), 9) },
  { id: "high_five", category: "Game Modes", title: "High Five", description: "Score 5 or more marks in one Cricket round.", icon: "star", tier: 1, test: (c) => maxBadge(c.games, (g) => (cricket(g) ? m(g, "bestRound") || Math.max(0, ...(g.row.stats?.roundMarks || [])) : 0), 5) },
  { id: "nine_marks", category: "Game Modes", title: "Nine-Mark Round", description: "Score 9 marks in one Cricket round (three trebles).", icon: "triple", tier: 3, test: (c) => maxBadge(c.games, (g) => (cricket(g) ? m(g, "bestRound") || Math.max(0, ...(g.row.stats?.roundMarks || [])) : 0), 9) },
  { id: "shanghai_win", category: "Game Modes", title: "Shanghai!", description: "Win a ranked Shanghai game with a Shanghai (single, double and treble in one round).", icon: "burst", tier: 2, test: (c) => firstBadge(c.games, (g) => g.row.gameType === "shanghai" && g.won && !!g.row.stats?.shanghai) },
  { id: "killer_win", category: "Game Modes", title: "Last One Standing", description: "Win a ranked game of Killer.", icon: "skull", test: (c) => firstBadge(c.games, (g) => g.row.gameType === "killer" && g.won) },
  { id: "clock_win", category: "Game Modes", title: "Around the World", description: "Win a ranked game of Around the Clock.", icon: "compass", test: (c) => firstBadge(c.games, (g) => g.row.gameType === "aroundTheClock" && g.won) },
  // ---- variety ----
  { id: "all_rounder", category: "Variety", title: "All-Rounder", description: "Win in three different game types.", icon: "dice", test: (c) => { const seen = new Set(); let earnedAt = null; for (const g of c.games) { if (!g.won) continue; seen.add(g.row.gameType); if (seen.size === 3 && !earnedAt) earnedAt = day(g.date); } return { earnedAt, progress: { value: Math.min(seen.size, 3), target: 3, kind: "count" } }; } },
  { id: "explorer", category: "Variety", title: "Explorer", description: "Play six different game types (drills count).", icon: "compass", test: (c) => { const seen = new Set(); let earnedAt = null; const all = [...c.games, ...c.drills].sort((a, b) => new Date(a.date) - new Date(b.date)); for (const g of all) { seen.add(g.row.gameType); if (seen.size === 6 && !earnedAt) earnedAt = day(g.date); } return { earnedAt, progress: { value: Math.min(seen.size, 6), target: 6, kind: "count" } }; } },
];

export const CATEGORIES = [...new Set(ACHIEVEMENTS.map((a) => a.category))];

/**
 * All badges for one player with unlock state. `social` is null for other
 * players (their follows are private), which omits the selfOnly badges.
 */
export function computeAchievements({ me, results, practice, social = null, now = new Date() }) {
  const ctx = buildContext({ me, results, practice, social, now });
  return ACHIEVEMENTS.filter((a) => !a.selfOnly || social).map((a) => {
    let r;
    try {
      r = a.test(ctx) || {};
    } catch {
      r = {};
    }
    const { test, ...def } = a;
    return { ...def, unlocked: !!r.earnedAt, earnedAt: r.earnedAt || null, progress: r.progress || null };
  });
}

/**
 * How a locked badge's progress reads. Counting badges say how many to go;
 * single-game records say the best so far; streaks say the current run.
 */
export function progressText(p, { short = false } = {}) {
  if (!p || !p.target) return "";
  if (p.kind === "best") return short ? `Best ${p.value} / ${p.target}` : `Your best so far is ${p.value}. The target is ${p.target}.`;
  if (p.kind === "streak") return short ? `Run ${p.value} / ${p.target}` : `Current run ${p.value} of ${p.target}${p.best > p.value ? ` · best ever ${p.best}` : ""}`;
  const left = Math.max(0, p.target - p.value);
  return short ? `${p.value} / ${p.target}` : `${p.value} / ${p.target} · ${left} to go`;
}

/** Badges unlocked in `after` that were not in `before`. */
export function diffUnlocked(before, after) {
  const had = new Set((before || []).filter((b) => b.unlocked).map((b) => b.id));
  return (after || []).filter((b) => b.unlocked && !had.has(b.id));
}

/** How far along a badge is, 0..1 (Elo badges measure from the 1000 start). */
function frac(p) {
  const base = p.base || 0;
  return Math.max(0, (p.value - base) / (p.target - base || 1));
}

/** Badges that are still locked, closest to unlocking first. */
export function nextUp(badges, n = 5) {
  return (badges || [])
    .filter((b) => !b.unlocked && b.progress && b.progress.target > 0 && frac(b.progress) > 0)
    .sort((a, b) => frac(b.progress) - frac(a.progress))
    .slice(0, n);
}

// ---- "seen" bookkeeping (per account, in the browser) ----
export function seenKey(authId) {
  return `bb-badges-seen:${authId || "anon"}`;
}

export function readSeen(storage, key) {
  try {
    const raw = storage && storage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function writeSeen(storage, key, ids) {
  try {
    storage && storage.setItem(key, JSON.stringify([...new Set(ids)]));
  } catch {}
}
