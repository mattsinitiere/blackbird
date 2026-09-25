/**
 * Turning a plan item into a game the existing play screens run, and
 * checking a plan only asks for games this player can actually start
 * (unlocked bots, enough history for Alter Ego). Pure.
 */

import { newGameId } from "./games.js";
import { BOTS, BOT_PREFIX } from "./bots.js";
import { botLadder } from "./practice.js";
import { buildProfile, frozenConfig, ALTER_EGO_ID } from "./alterEgo.js";
import { launchSpec } from "./trainingPlans.js";

/** Bot ids this player has unlocked, from their practice rows. */
export function unlockedBots(practiceRows, me) {
  return new Set(botLadder(practiceRows || [], me).filter((l) => l.unlocked).map((l) => l.bot.id));
}

/**
 * Items a player can't start yet: locked bots, or Alter Ego windows
 * without enough history. [] when the plan is fully playable.
 */
export function unplayableItems(plan, { rows, me, now = new Date() }) {
  const practice = (rows || []).filter((r) => r.result === "practice");
  const open = unlockedBots(practice, me);
  const out = [];
  (plan?.sessions || []).forEach((s, si) =>
    s.items.forEach((it, ii) => {
      if (it.type === "bot" && !open.has(it.config.bot)) {
        const b = BOTS.find((x) => x.id === it.config.bot);
        out.push({ session: si, item: ii, reason: `${b ? b.name : "That bot"} isn't unlocked yet` });
      }
      if (it.type === "alterEgo") {
        const p = buildProfile(rows || [], { me, window: it.config.window, now });
        if (!p.ok) out.push({ session: si, item: ii, reason: "Not enough X01 history for Alter Ego in that window yet" });
      }
    })
  );
  return out;
}

/**
 * The game object for one plan item, or { error }. `rows` are the
 * player's own rows (for Alter Ego's frozen profile).
 */
export function planGame({ planId, session, item, total, planItem, me, rows, now = new Date() }) {
  const spec = launchSpec(planId, session, item, planItem, total);
  if (!spec) return { error: "That drill can't be started." };
  const base = { id: newGameId(), gameType: spec.gameType, startedAt: new Date(now).toISOString() };
  if (spec.bot) {
    const bot = BOTS.find((b) => b.id === spec.bot);
    if (!bot) return { error: "That bot no longer exists." };
    const config = spec.gameType === "cricket" ? { variant: "standard" } : { startScore: 501, doubleOut: true, legs: 1 };
    return { game: { ...base, players: [me, bot.id], config: { ...config, bot: { id: bot.id, level: bot.level }, plan: spec.config.plan } } };
  }
  if (spec.alterEgo) {
    const profile = buildProfile(rows || [], { me, window: spec.alterEgo.window, now });
    if (!profile.ok) return { error: "Not enough X01 history for Alter Ego yet." };
    return {
      game: { ...base, players: [me, ALTER_EGO_ID], config: { startScore: 501, doubleOut: true, legs: 1, alterEgo: frozenConfig(profile), plan: spec.config.plan } },
    };
  }
  return { game: { ...base, players: [me], config: spec.config } };
}

/** True for any bot id, Alter Ego included (kept here so callers need one import). */
export const isBotId = (u) => typeof u === "string" && u.startsWith(BOT_PREFIX);
