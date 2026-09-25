import { BASE_ELO } from "./constants.js";

// column sets, newest first; older databases that haven't run every
// migration fall back to the next one down
export const PLAYER_SELECTS = [
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location, tag, tag_icon, cover",
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location, tag, tag_icon",
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location",
  "id, username, created_at, hidden, elo, color, auth_id",
  "id, username, created_at, hidden, elo, color",
];

/** A players row in the in-memory shape (shared with lib/useMyPlayer.js). */
export function playerFromRow(r) {
  return {
    id: r.id ?? null,
    username: r.username,
    createdAt: r.created_at,
    hidden: !!r.hidden,
    elo: r.elo == null ? BASE_ELO : Number(r.elo),
    color: r.color || null,
    authId: r.auth_id || null,
    handle: r.handle || null,
    bio: r.bio || "",
    location: r.location || "",
    tag: r.tag || null,
    tagIcon: r.tag_icon || null,
    cover: r.cover || null,
  };
}

