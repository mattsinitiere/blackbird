import { isBot } from "./bots.js";

/**
 * Friends = one-way follows. An account (auth id) follows player rows
 * (players.id). The database only returns result rows for yourself and
 * the players you follow (see supabase/migration-follows-tags.sql), so
 * these helpers only translate between ids and usernames and shape the
 * lists the UI shows. Pure.
 */

/** Usernames the account follows. */
export function followingUsernames(follows, players, myAuthId) {
  const out = new Set();
  if (!Array.isArray(follows) || !myAuthId) return out;
  const byId = new Map((players || []).map((p) => [p.id, p.username]));
  for (const f of follows) {
    if (f.follower === myAuthId && byId.has(f.followed)) out.add(byId.get(f.followed));
  }
  return out;
}

/** Usernames of the accounts that follow my player row. */
export function followerUsernames(follows, players, myPlayerId) {
  const out = new Set();
  if (!Array.isArray(follows) || !myPlayerId) return out;
  const byAuth = new Map((players || []).filter((p) => p.authId).map((p) => [p.authId, p.username]));
  for (const f of follows) {
    if (f.followed === myPlayerId && byAuth.has(f.follower)) out.add(byAuth.get(f.follower));
  }
  return out;
}

/**
 * The players whose games I can see: me first, then who I follow, in the
 * roster's order. `following === null` means the follows table is not
 * installed yet, so everyone is in the circle (today's behaviour).
 */
export function circlePlayers(players, following, me) {
  const list = players || [];
  if (following == null) return list;
  const mine = list.filter((p) => p.username === me);
  const rest = list.filter((p) => p.username !== me && following.has(p.username));
  return [...mine, ...rest];
}

/**
 * Search the roster by name or @handle. Exact handle first, then name
 * prefix, then handle prefix, then substring. Bots and `exclude` are left
 * out. An empty query returns nothing.
 */
export function searchPlayers(players, query, { exclude = [], limit = 20 } = {}) {
  const q = String(query || "").trim().replace(/^@+/, "").toLowerCase();
  if (!q) return [];
  const skip = new Set(exclude);
  const rank = (p) => {
    const name = (p.username || "").toLowerCase();
    const handle = (p.handle || "").toLowerCase();
    if (handle === q) return 0;
    if (name === q) return 1;
    if (name.startsWith(q)) return 2;
    if (handle.startsWith(q)) return 3;
    if (name.includes(q) || handle.includes(q)) return 4;
    return -1;
  };
  return (players || [])
    .filter((p) => p && !isBot(p.username) && !skip.has(p.username))
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.p.username.localeCompare(b.p.username))
    .slice(0, limit)
    .map((x) => x.p);
}

/** Following / followers lists with dates, for the Friends screen and achievements. */
export function followsForSocial(follows, players, { myAuthId, myPlayerId }) {
  const byId = new Map((players || []).map((p) => [p.id, p.username]));
  const byAuth = new Map((players || []).filter((p) => p.authId).map((p) => [p.authId, p.username]));
  const following = [];
  const followers = [];
  for (const f of Array.isArray(follows) ? follows : []) {
    if (f.follower === myAuthId && byId.has(f.followed)) following.push({ username: byId.get(f.followed), createdAt: f.createdAt });
    if (myPlayerId && f.followed === myPlayerId && byAuth.has(f.follower)) followers.push({ username: byAuth.get(f.follower), createdAt: f.createdAt });
  }
  const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  return { following: following.sort(byDate), followers: followers.sort(byDate) };
}
