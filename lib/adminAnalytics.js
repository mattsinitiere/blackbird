/**
 * Admin Panel analytics: sign-ups, activity, games, AI usage and cost,
 * training. Pure aggregation over rows the admin route has already read
 * with the service role, so it can be tested without a database.
 *
 * Counting rules:
 * - games are distinct game_id (one result row per player per game);
 * - "active" means a visit event or a game in the period;
 * - AI cost is estimated only when per-million-token prices are set
 *   (AI_PRICE_INPUT_PER_1M / AI_PRICE_OUTPUT_PER_1M); otherwise null;
 * - days, weeks and months are in the reporting timezone (lib/data/tz.js).
 */

import { dayKey, weekKey, monthKey, REPORT_TZ } from "./data/tz.js";

export const RANGES = [
  { id: "7d", label: "7 Days", days: 7, bucket: "day" },
  { id: "30d", label: "30 Days", days: 30, bucket: "day" },
  { id: "90d", label: "90 Days", days: 90, bucket: "week" },
  { id: "12m", label: "12 Months", days: 365, bucket: "month" },
  { id: "all", label: "All Time", days: null, bucket: "month" },
];

export function rangeFor(id, now = new Date()) {
  const r = RANGES.find((x) => x.id === id) || RANGES[1];
  const to = new Date(now);
  const from = r.days ? new Date(to.getTime() - r.days * 86400000) : null;
  return { ...r, from, to };
}

const keyFor = (bucket) => (bucket === "day" ? dayKey : bucket === "week" ? weekKey : monthKey);

/** Every bucket key from `from` to `to`, so empty periods show as zero. */
export function bucketKeys(from, to, bucket) {
  const k = keyFor(bucket);
  const out = [];
  const seen = new Set();
  const step = bucket === "day" ? 3600000 * 6 : bucket === "week" ? 86400000 : 86400000 * 7;
  for (let t = new Date(from).getTime(); t <= new Date(to).getTime(); t += step) {
    const key = k(t);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  const last = k(to);
  if (!seen.has(last)) out.push(last);
  return out;
}

function series(items, getTime, from, to, bucket, weight = () => 1) {
  const k = keyFor(bucket);
  const counts = new Map();
  for (const it of items) {
    const t = getTime(it);
    if (t == null) continue;
    const key = k(t);
    counts.set(key, (counts.get(key) || 0) + weight(it));
  }
  const start = from || (items.length ? new Date(Math.min(...items.map((i) => new Date(getTime(i)).getTime()).filter(Number.isFinite))) : to);
  return bucketKeys(start, to, bucket).map((key, i) => ({ x: i + 1, y: counts.get(key) || 0, label: key, date: key.length === 7 ? `${key}-01` : key }));
}

const inRange = (t, from, to) => {
  if (t == null) return false;
  const ms = new Date(t).getTime();
  return (!from || ms >= from.getTime()) && ms <= to.getTime();
};

/**
 * @param {object} d
 * @param {object[]} d.users       [{ id, createdAt, lastSignInAt }]
 * @param {object[]} d.players     [{ username, authId }]
 * @param {object[]} d.events      [{ auth_id, kind, day }]
 * @param {object[]} d.games       [{ game_id, username, game_type, result, opponents, completed_at }]
 * @param {object[]|null} d.aiLog  ai_request_log rows, or null if the table isn't there
 * @param {object[]} d.aiUsage     ai_usage rows [{ auth_id, day, count }]
 * @param {object[]|null} d.plans  training_plans rows [{ auth_id, source, created_at }], or null
 * @param {object[]|null} d.completions plan_completions rows [{ completed_at }], or null
 * @param {{input:number|null, output:number|null}} d.prices  USD per 1M tokens
 */
export function buildAnalytics(d, rangeId = "30d", now = new Date()) {
  const range = rangeFor(rangeId, now);
  const { from, to, bucket } = range;
  const users = d.users || [];
  const nameByAuth = new Map((d.players || []).filter((p) => p.authId).map((p) => [p.authId, p.username]));

  // sign-ups
  const newUsers = users.filter((u) => inRange(u.createdAt, from, to));
  const signups = { total: users.length, inRange: newUsers.length, series: series(newUsers, (u) => u.createdAt, from, to, bucket), linked: users.filter((u) => nameByAuth.has(u.id)).length };

  // games (distinct game ids)
  const gamesIn = (d.games || []).filter((g) => inRange(g.completed_at, from, to));
  const byGame = new Map();
  for (const g of gamesIn) if (!byGame.has(g.game_id)) byGame.set(g.game_id, g);
  const distinct = [...byGame.values()];
  const byMode = {};
  for (const g of distinct) byMode[g.game_type] = (byMode[g.game_type] || 0) + 1;
  const ranked = distinct.filter((g) => g.result !== "practice").length;
  const alterEgo = distinct.filter((g) => (g.opponents || []).includes("bot:alterego")).length;
  const games = { games: distinct.length, ranked, practice: distinct.length - ranked, byMode, series: series(distinct, (g) => g.completed_at, from, to, bucket) };

  // activity: visit events or games
  const activeIds = new Set();
  const visitsIn = (d.events || []).filter((e) => e.kind === "visit" && inRange(`${e.day}T12:00:00Z`, from, to));
  for (const e of visitsIn) activeIds.add(e.auth_id);
  const authByName = new Map((d.players || []).filter((p) => p.authId).map((p) => [p.username, p.authId]));
  const playingIds = new Set(gamesIn.map((g) => authByName.get(g.username)).filter(Boolean));
  for (const id of playingIds) activeIds.add(id);
  const dauSets = new Map();
  for (const e of visitsIn) {
    const k = keyFor(bucket)(`${e.day}T12:00:00Z`);
    if (!dauSets.has(k)) dauSets.set(k, new Set());
    dauSets.get(k).add(e.auth_id);
  }
  const activeSeries = series([...dauSets.entries()].map(([k, set]) => ({ k, n: set.size })), (x) => (x.k.length === 7 ? `${x.k}-15T12:00:00Z` : `${x.k}T12:00:00Z`), from, to, bucket, (x) => x.n);
  const active = { users: activeIds.size, played: playingIds.size, series: activeSeries };

  // AI
  let ai = null;
  if (d.aiLog) {
    const log = d.aiLog.filter((r) => inRange(r.created_at, from, to));
    const sum = (f) => log.reduce((a, r) => a + (Number(r[f]) || 0), 0);
    const known = log.filter((r) => r.input_tokens != null || r.output_tokens != null);
    const byKind = {};
    for (const r of log) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    const perUser = new Map();
    for (const r of log) perUser.set(r.auth_id, (perUser.get(r.auth_id) || 0) + 1);
    const topUsers = [...perUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ name: nameByAuth.get(id) || "Unlinked account", requests: n }));
    const tokensIn = sum("input_tokens");
    const tokensOut = sum("output_tokens");
    const p = d.prices || {};
    const cost = p.input != null && p.output != null ? { input: (tokensIn / 1e6) * p.input, output: (tokensOut / 1e6) * p.output } : null;
    if (cost) cost.total = cost.input + cost.output;
    ai = {
      requests: log.length,
      ok: log.filter((r) => r.status === "ok").length,
      errors: log.filter((r) => r.status === "error").length,
      limited: log.filter((r) => r.status === "limit").length,
      fallbacks: log.filter((r) => r.fallback).length,
      summaryOnly: log.filter((r) => r.via === "plain").length,
      tokensIn,
      tokensOut,
      tokensCoverage: log.length ? known.length / log.length : null,
      avgMs: log.length ? Math.round(sum("duration_ms") / log.length) : null,
      models: [...new Set(log.map((r) => r.model).filter(Boolean))],
      efforts: [...new Set(log.map((r) => r.effort).filter(Boolean))],
      byKind,
      topUsers,
      cost,
      series: series(log, (r) => r.created_at, from, to, bucket),
    };
  }
  // the daily allowance counter predates the log: request counts only
  const usageIn = (d.aiUsage || []).filter((u) => inRange(`${u.day}T12:00:00Z`, from, to));
  const allowance = { requests: usageIn.reduce((a, u) => a + (u.count || 0), 0), series: series(usageIn, (u) => `${u.day}T12:00:00Z`, from, to, bucket, (u) => u.count || 0) };

  // training
  const training = d.plans
    ? {
        plans: d.plans.length,
        createdInRange: d.plans.filter((p) => inRange(p.created_at, from, to)).length,
        ai: d.plans.filter((p) => p.source === "ai").length,
        custom: d.plans.filter((p) => p.source === "custom").length,
        completions: (d.completions || []).filter((c) => inRange(c.completed_at, from, to)).length,
        alterEgoGames: alterEgo,
      }
    : { plans: null, alterEgoGames: alterEgo };

  return { range: { id: range.id, label: range.label, from: from ? from.toISOString() : null, to: to.toISOString(), bucket, tz: REPORT_TZ }, signups, active, games, ai, allowance, training };
}
