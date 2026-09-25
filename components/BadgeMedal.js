import { useId } from "react";
import { iconParts } from "@/lib/icons";

/** One color per achievement category; white line icons sit on top. */
export const CATEGORY_COLORS = {
  Milestones: "#3d45b8",
  Scoring: "#d4582a",
  Finishing: "#c42f4f",
  Cricket: "#1d8a5a",
  Streaks: "#7a3fc0",
  Social: "#16889f",
  Practice: "#2f6fdf",
  Variety: "#b3407f",
};
// tiered badges (10 / 50 / 200 games…) get a bronze, silver or gold rim
const TIER_RIMS = { 1: "#c98a4b", 2: "#b9c1cc", 3: "#e8b931" };

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * An achievement's medallion: a category-colored disc with a soft sheen,
 * an inner ring, the badge's line icon in white and, for tiered badges, a
 * metal rim. Locked badges are drawn flat in the theme's neutral tones.
 */
export default function BadgeMedal({ badge, size = 44, locked = false, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const base = CATEGORY_COLORS[badge?.category] || "#3d45b8";
  const rim = badge?.tier ? TIER_RIMS[badge.tier] : null;
  const parts = iconParts(badge?.icon);
  return (
    <svg
      className={`badge-medal${locked ? " is-locked" : ""} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`bm-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(base, 0.22)} />
          <stop offset="1" stopColor={shade(base, -0.28)} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={locked ? "var(--surface-2)" : `url(#bm-${uid})`} stroke={locked ? "var(--line-strong)" : rim || shade(base, -0.4)} strokeWidth={rim && !locked ? 3 : 1.5} />
      {!locked && <path d="M7 20a17.5 17.5 0 0 1 34 0" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />}
      <circle cx="24" cy="24" r="16.5" fill="none" stroke={locked ? "var(--line)" : "#fff"} strokeOpacity={locked ? 1 : 0.3} strokeWidth="1" />
      <g transform="translate(11.5 11.5) scale(1.0417)" fill="none" stroke={locked ? "var(--muted)" : "#fff"} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {parts.map((p, i) => (
          <path key={i} d={p.d} fill={p.fill ? (locked ? "var(--muted)" : "#fff") : "none"} stroke={p.fill ? "none" : undefined} />
        ))}
      </g>
    </svg>
  );
}
