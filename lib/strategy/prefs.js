/**
 * Hint settings, stored in the user's metadata like the other gameplay
 * preferences (Settings → Gameplay). Hints are advisory only.
 */
export const HINT_MODES = [
  { id: "off", label: "Off" },
  { id: "standard", label: "Standard" },
  { id: "personalized", label: "Personalized" },
];
export const PREFERRED_DOUBLES = ["D20", "D16", "D8", "D10", "D18", "D12", "D4", "D6", "D14", "D2", "Bull"];

/** { mode, preferredDouble } from user_metadata, with defaults. */
export function hintPrefs(meta = {}) {
  return {
    mode: HINT_MODES.some((h) => h.id === meta.hints) ? meta.hints : "standard",
    preferredDouble: PREFERRED_DOUBLES.includes(meta.preferredDouble) ? meta.preferredDouble : null,
  };
}
