/**
 * Shareable profile links: /app?player=<handle or name>. The app opens
 * that player's profile once the signed-in roster has loaded. Pure.
 */

export const PROFILE_PARAM = "player";

export function profileHref(player) {
  const id = (player && (player.handle || player.username)) || "";
  return id ? `/app?${PROFILE_PARAM}=${encodeURIComponent(id)}` : "/app";
}

/** The username a `?player=` value points at: @handle first, then name. */
export function resolveProfileParam(value, players) {
  const q = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  if (!q) return null;
  const list = players || [];
  const byHandle = list.find((p) => (p.handle || "").toLowerCase() === q);
  if (byHandle) return byHandle.username;
  const byName = list.find((p) => (p.username || "").toLowerCase() === q);
  return byName ? byName.username : null;
}
