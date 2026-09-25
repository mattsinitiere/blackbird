import { randomUUID } from "node:crypto";
import { renamePlayerEverywhere } from "./playerRename.js";

/**
 * Account deletion (admin panel → Delete account). What the privacy policy
 * promises, in order:
 *
 * 1. The player linked to the account is renamed "Deleted player xxxxxx"
 *    everywhere, so past games stay in opponents' histories, Elo and
 *    head-to-head records without the person's name.
 * 2. Profile details are cleared (handle, bio, town, tag, cover, colour)
 *    and the player is hidden from the leaderboard.
 * 3. Follows of that player are removed.
 * 4. The login is deleted. Its AI request log, daily AI counts, app-visit
 *    records, training plans and own follows go with it (on delete cascade).
 *
 * The anonymized row keeps its auth_id, the deleted account's id. Nobody
 * can sign in as that id again, and a linked row can't be claimed: both
 * /api/link-players and the players_guard_identity trigger only link rows
 * whose auth_id is null.
 *
 * Safe to run again: an already-anonymized player is not renamed twice, and
 * a login that is already gone counts as deleted.
 */

export const DELETED_PREFIX = "Deleted player";

export function isDeletedPlayerName(name) {
  return typeof name === "string" && name.startsWith(DELETED_PREFIX);
}

const CLEARED_PROFILE = { handle: null, bio: null, location: null, tag: null, tag_icon: null, cover: null, color: null, hidden: true };

async function freeDeletedName(admin, makeId) {
  for (let i = 0; i < 8; i++) {
    const name = `${DELETED_PREFIX} ${makeId().replace(/-/g, "").slice(0, 6)}`;
    const { data, error } = await admin.from("players").select("username").eq("username", name).maybeSingle();
    if (error) throw error;
    if (!data) return name;
  }
  throw new Error("Couldn't find a free name for the deleted player.");
}

export async function deleteAccount(admin, userId, { makeId = randomUUID } = {}) {
  if (!userId) throw new Error("Missing user.");
  const { data: players, error } = await admin.from("players").select("id, username").eq("auth_id", userId);
  if (error) throw error;

  const renamed = [];
  for (const p of players || []) {
    let name = p.username;
    if (!isDeletedPlayerName(name)) {
      name = await freeDeletedName(admin, makeId);
      await renamePlayerEverywhere(admin, p.username, name);
    }
    const { error: e1 } = await admin.from("players").update(CLEARED_PROFILE).eq("id", p.id);
    if (e1) throw e1;
    const { error: e2 } = await admin.from("follows").delete().eq("followed", p.id);
    if (e2) throw e2;
    renamed.push(name);
  }

  const { error: e3 } = await admin.auth.admin.deleteUser(userId);
  if (e3 && e3.status !== 404) throw e3;
  return { players: renamed };
}
