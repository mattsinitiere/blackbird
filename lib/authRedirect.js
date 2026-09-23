/**
 * Where to send someone after they sign in. Only a path on this site is
 * accepted; anything that could leave the origin (`//evil`, `/\evil`, a
 * full URL, header-injection characters) falls back.
 */
export function safeNext(raw, fallback = "/app") {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (/[\r\n\0]/.test(raw)) return fallback;
  return raw;
}
