import { normalizeHandle, validateHandle, normalizeTag, validateTag, isTagIcon } from "./profile.js";

/**
 * Admin "Add New Player": validate the form, then create the sign-in
 * account and its linked player row. Pure except `createAccount`, which
 * takes the service-role Supabase client (so it can be tested with a fake).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX = /^#[0-9a-f]{6}$/i;

/** @returns {{ ok: true, value } | { ok: false, error }} */
export function validateNewAccount(input = {}) {
  const displayName = String(input.displayName || "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 24) return { ok: false, error: "Name must be 2 to 24 characters." };
  const email = String(input.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };
  const handle = normalizeHandle(input.handle);
  const hc = validateHandle(handle);
  if (!hc.ok) return { ok: false, error: `Handle: ${hc.reason}` };
  const password = String(input.password || "");
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const color = input.color ? String(input.color) : null;
  if (color && !HEX.test(color)) return { ok: false, error: "Pick a color." };
  const tag = normalizeTag(input.tag || "");
  const tc = validateTag(tag);
  if (!tc.ok) return { ok: false, error: `Tag: ${tc.reason}` };
  const tagIcon = input.tagIcon || null;
  if (tagIcon && !isTagIcon(tagIcon)) return { ok: false, error: "Unknown tag icon." };
  return { ok: true, value: { displayName, email, handle, password, color, tag: tag || null, tagIcon } };
}

/**
 * Create the auth user (confirmed, so they can sign in straight away) and
 * the player row linked to it. If the player row can't be created, the
 * auth user is deleted again so nothing is left half-made.
 */
export async function createAccount(admin, v) {
  // case-insensitive exact matches (escape ilike's wildcards)
  const exact = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: byName } = await admin.from("players").select("username").ilike("username", exact(v.displayName)).limit(1);
  if (byName && byName.length) return { ok: false, error: `${byName[0].username} is already a player.` };
  const { data: byHandle } = await admin.from("players").select("username").ilike("handle", exact(v.handle)).limit(1);
  if (byHandle && byHandle.length) return { ok: false, error: `@${v.handle} is already taken by ${byHandle[0].username}.` };
  const { data: created, error: ue } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { display_name: v.displayName, handle: v.handle },
  });
  if (ue || !created?.user) return { ok: false, error: ue?.message || "Couldn't create the account." };
  const row = { username: v.displayName, auth_id: created.user.id, handle: v.handle };
  if (v.color) row.color = v.color;
  if (v.tag) row.tag = v.tag;
  if (v.tagIcon) row.tag_icon = v.tagIcon;
  const { error: pe } = await admin.from("players").insert(row);
  if (pe) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: pe.message || "Couldn't create the player." };
  }
  return { ok: true, userId: created.user.id, username: v.displayName };
}

/** Validate an admin tag edit. */
export function validateTagEdit(input = {}) {
  const tag = normalizeTag(input.tag || "");
  const tc = validateTag(tag);
  if (!tc.ok) return { ok: false, error: tc.reason };
  const tagIcon = input.tagIcon || null;
  if (tagIcon && !isTagIcon(tagIcon)) return { ok: false, error: "Unknown tag icon." };
  return { ok: true, value: { tag: tag || null, tag_icon: tagIcon } };
}
