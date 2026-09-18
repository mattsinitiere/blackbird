/**
 * @handle rules shared by sign-up, Account, and the backfill on first
 * sign-in. Mirrors the DB check constraint: 3–20 chars of [a-z0-9_].
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const BIO_MAX = 160;
export const LOCATION_MAX = 60;

const RESERVED = new Set([
  "admin", "administrator", "blackbird", "support", "help", "api", "tv", "me", "you",
  "settings", "account", "login", "signup", "signin", "logout", "bot", "bots", "system",
  "official", "moderator", "mod", "root", "null", "undefined", "guest", "player",
]);

/** Lowercase, strip the leading @, drop anything outside [a-z0-9_]. */
export function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, HANDLE_MAX);
}

/** @returns {{ ok: boolean, reason?: string }} */
export function validateHandle(handle) {
  const h = String(handle || "");
  if (h.length < HANDLE_MIN) return { ok: false, reason: `At least ${HANDLE_MIN} characters.` };
  if (h.length > HANDLE_MAX) return { ok: false, reason: `At most ${HANDLE_MAX} characters.` };
  if (!/^[a-z0-9_]+$/.test(h)) return { ok: false, reason: "Letters, numbers and underscores only." };
  if (/^_+$/.test(h)) return { ok: false, reason: "Needs at least one letter or number." };
  if (RESERVED.has(h)) return { ok: false, reason: "That handle is reserved." };
  return { ok: true };
}

/** A starting handle from a display name: "Matt S." -> "matts". */
export function suggestHandle(displayName) {
  let h = normalizeHandle(displayName);
  if (h.length < HANDLE_MIN) h = (h + "000").slice(0, HANDLE_MIN);
  if (RESERVED.has(h)) h = (h + "_1").slice(0, HANDLE_MAX);
  return h;
}

export function formatHandle(handle) {
  return handle ? `@${handle}` : "";
}
