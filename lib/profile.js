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

// ---- Name tags: a short Discord-style badge shown beside the name ----------
export const TAG_MIN = 2;
export const TAG_MAX = 5;
const RESERVED_TAGS = new Set(["ADMIN", "STAFF", "MOD", "BOT", "SYS", "NULL"]);

/** Icon ids must match the check constraint in supabase/migration-follows-tags.sql. */
export const TAG_ICONS = [
  { id: "crown", label: "Crown", glyph: "👑" },
  { id: "flame", label: "Flame", glyph: "🔥" },
  { id: "bolt", label: "Bolt", glyph: "⚡" },
  { id: "star", label: "Star", glyph: "⭐" },
  { id: "target", label: "Target", glyph: "🎯" },
  { id: "skull", label: "Skull", glyph: "💀" },
  { id: "bird", label: "Bird", glyph: "🐦" },
  { id: "clover", label: "Clover", glyph: "🍀" },
  { id: "diamond", label: "Diamond", glyph: "💎" },
  { id: "anchor", label: "Anchor", glyph: "⚓" },
  { id: "ghost", label: "Ghost", glyph: "👻" },
  { id: "rocket", label: "Rocket", glyph: "🚀" },
];

/** Upper-case, letters and digits only, at most TAG_MAX characters. */
export function normalizeTag(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TAG_MAX);
}

/** @returns {{ ok: boolean, reason?: string }}; an empty tag is fine (no tag). */
export function validateTag(tag) {
  const t = String(tag || "");
  if (!t) return { ok: true };
  if (t.length < TAG_MIN) return { ok: false, reason: `At least ${TAG_MIN} characters.` };
  if (t.length > TAG_MAX) return { ok: false, reason: `At most ${TAG_MAX} characters.` };
  if (!/^[A-Z0-9]+$/.test(t)) return { ok: false, reason: "Letters and numbers only." };
  if (RESERVED_TAGS.has(t)) return { ok: false, reason: "That tag is reserved." };
  return { ok: true };
}

export function isTagIcon(id) {
  return !!id && TAG_ICONS.some((i) => i.id === id);
}

export function tagGlyph(id) {
  const i = TAG_ICONS.find((x) => x.id === id);
  return i ? i.glyph : "";
}

/** "👑 ABC", "👑" or "ABC" — what the pill and the share card show. */
export function formatTag({ tag, tagIcon } = {}) {
  return [tagGlyph(tagIcon), tag || ""].filter(Boolean).join(" ");
}
