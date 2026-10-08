import { useId } from "react";
import { botFor, botColors } from "@/lib/bots";

/**
 * Bot avatars: a plain donut ring in the bot's color, with a soft diagonal
 * gradient (lighter top-left, deeper bottom-right) so it reads as one
 * solid mark at any size. Very dark bot colors are lifted a little so the
 * ring still shows on the dark theme. Pure SVG, sharp at any size.
 */

const COLORS = botColors();

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

/** Every bot id with a color (the ladder plus Alter Ego) gets a ring. */
export function hasPortrait(id) {
  return !!COLORS[id];
}

export default function BotAvatar({ bot, size = 32, sizeCss, locked = false, title }) {
  const uid = useId().replace(/:/g, "");
  const b = typeof bot === "string" ? botFor(bot) : bot;
  const id = typeof bot === "string" ? bot : bot?.id;
  const color = b?.color || COLORS[id] || "#8b8f97";
  const dark = luminance(color) < 60;
  const from = shade(color, dark ? 0.42 : 0.28);
  const to = dark ? shade(color, 0.12) : shade(color, -0.22);
  const dim = sizeCss || size;
  return (
    <svg
      className={`bot-avatar${locked ? " is-locked" : ""}`}
      width={sizeCss ? undefined : dim}
      height={sizeCss ? undefined : dim}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
      // CSS lengths (calc, var, %) go in style: SVG width/height attributes can't take them
      style={{ flex: "none", display: "block", width: dim, height: dim }}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22.5" fill="none" stroke={`url(#bg-${uid})`} strokeWidth="15" />
    </svg>
  );
}
