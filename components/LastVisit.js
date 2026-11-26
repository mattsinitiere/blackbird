import { dartLabel } from "@/lib/darts";
import { playerLabel } from "@/lib/bots";

/**
 * The previous thrower's visit, above the keypad until the next visit's
 * first dart (lib/lastVisit.js picks when). `last` is { by, darts };
 * `outcome` says what the visit did ("scored 60, 441 left"); `inline` fits
 * it into the row where the darts entered so far show.
 */
export default function LastVisit({ last, outcome, inline = false }) {
  if (!last) return null;
  const darts = last.darts || [];
  return (
    <div className={`last-visit${inline ? " is-inline" : ""}`} role="status">
      <b>{playerLabel(last.by)}</b>&apos;s last visit: {darts.length ? darts.map(dartLabel).join(" · ") : "no darts"}
      {outcome ? ` — ${outcome}` : ""}
    </div>
  );
}
