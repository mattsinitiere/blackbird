import { localDay } from "./achievements.js";

/**
 * Turn the player's own events (supabase player_events: app visits and
 * first profile customizations) into what the achievements read. Pure.
 * @returns {{ visitDays: string[], profile: { [part]: iso } }}
 */
export function activityFromEvents(events) {
  const visitDays = [];
  const profile = {};
  for (const e of events || []) {
    if (e.kind === "visit") visitDays.push(String(e.day).slice(0, 10));
    else if (e.kind === "profile" && e.detail) {
      const at = e.created_at || e.createdAt || e.day;
      if (!profile[e.detail] || at < profile[e.detail]) profile[e.detail] = at;
    }
  }
  return { visitDays: [...new Set(visitDays)].sort(), profile };
}

/** Which profile parts a player row has customized. */
export function customisedParts(player) {
  if (!player) return [];
  const out = [];
  if (player.color) out.push("color");
  if (player.cover) out.push("cover");
  if ((player.bio || "").trim()) out.push("bio");
  if ((player.location || "").trim()) out.push("location");
  if (player.tag || player.tagIcon) out.push("tag");
  if (player.handle) out.push("handle");
  return out;
}

/** Profile parts that are set but not logged yet (to record now). */
export function profileEventsToRecord(player, activity) {
  const have = activity?.profile || {};
  return customisedParts(player).filter((k) => !have[k]);
}

export const todayKey = (now = new Date()) => localDay(now.toISOString());
