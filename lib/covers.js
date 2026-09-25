/**
 * Profile cover designs. The id is stored on players.cover (null means
 * the default); the drawing lives in components/profile/ProfileCover.js.
 * Ids must match the check constraint in
 * supabase/migration-contours-cover.sql. Pure.
 */
export const COVERS = [
  { id: "playon", label: "Play On" },
  { id: "dartboard", label: "Dartboard" },
  { id: "flight", label: "Flight Path" },
  { id: "scoreboard", label: "Scoreboard" },
  { id: "night", label: "Night Flight" },
  { id: "contours", label: "Contours" },
];

export const DEFAULT_COVER = "playon";

export function coverId(id) {
  return COVERS.some((c) => c.id === id) ? id : DEFAULT_COVER;
}
