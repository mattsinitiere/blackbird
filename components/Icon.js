import { iconParts } from "@/lib/icons";

/**
 * One icon from lib/icons.js as inline SVG in `currentColor`. Sized in em
 * by default so it tracks the surrounding text (and the text-size setting).
 */
export default function Icon({ id, size = "1em", strokeWidth = 2, title, className, style }) {
  const parts = iconParts(id);
  if (!parts.length) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {parts.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ? "currentColor" : "none"} stroke={p.fill ? "none" : undefined} />
      ))}
    </svg>
  );
}
