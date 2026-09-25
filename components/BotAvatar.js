import { useId } from "react";
import { botFor } from "@/lib/bots";

/**
 * Bot portraits in the same language as the achievement medals: a disc in
 * the bot's color with a soft sheen and inner ring, and the bird drawn as
 * white line art (round caps, one stroke weight) facing right. Each bird
 * keeps one or two signature details, and a few carry a color accent:
 * Rook's learner plate, Falcon's and Kestrel's eye-rings, Magpie's glint,
 * Blackbird's gold beak and crown. Pure SVG, sharp at any size.
 */

const W = "#ffffff";
// shared bust outline: shoulders open at the bottom, head top-center
const BUST = "M15 54C15 43 18 35 23.5 30.5C26.5 23.5 32 19.5 38 19.5C44.5 19.5 48.5 24 48.5 29.5C48.5 34 46.5 37.5 45 40C47.5 43.5 49 48 49 54";
const BEAK = "M48 26.8L55.5 29.8L48 32.8";
const eye = (x = 40.5, y = 27.5, r = 2.1) => <circle cx={x} cy={y} r={r} fill={W} stroke="none" />;

const BIRDS = {
  // L1: bare pale face patch and a learner plate
  "bot:rook": () => (
    <>
      <path d={BUST} />
      <path d={BEAK} />
      <circle cx="46" cy="29.8" r="4.6" />
      {eye(39.5, 27, 2.1)}
      <rect x="18" y="38" width="10" height="10" rx="2" fill="#fff" stroke="#e03a3a" strokeWidth="1.6" />
      <path d="M21.3 40.6v5h4" stroke="#e03a3a" strokeWidth="2" />
    </>
  ),
  // L2: capped head, cheek patch, little bib
  "bot:sparrow": () => (
    <>
      <path d={BUST} />
      <path d={BEAK} />
      <path d="M25 30C29 24.5 34.5 22 41 22.3" />
      <ellipse cx="36.5" cy="32.5" rx="4.2" ry="3" />
      <path d="M45 35.5c2 2 2 5 .2 7" />
      {eye()}
    </>
  ),
  // L3: swept crest and a necklace
  "bot:jay": () => (
    <>
      <path d={BUST} />
      <path d={BEAK} />
      <path d="M26 27.5L17 17l9.5 4.2-1.2-9.2 7.6 7.8 3.2-6.8 2.3 7" />
      <path d="M27 47.5c5 2 10.5 1.5 14.5-2.5" />
      {eye()}
    </>
  ),
  // L4: white belly edge and the glint it's after
  "bot:magpie": () => (
    <>
      <path d={BUST} />
      <path d={BEAK} />
      <path d="M15.5 44c6.5 1 11.5 5 13.5 10" />
      <path d="M26 29c4-5 9-7.5 14.5-7.2" strokeOpacity="0.55" />
      {eye(40.5, 27.5, 2.1)}
      <path d="M53 14.5l1.1 2.8 2.8 1.1-2.8 1.1-1.1 2.8-1.1-2.8-2.8-1.1 2.8-1.1z" fill="#fbbf24" stroke="none" />
    </>
  ),
  // L5: heavy beak, throat hackles, half-lidded side-eye
  "bot:raven": () => (
    <>
      <path d={BUST} />
      <path d="M47.5 25.2c6.5-.4 10 2.2 9.3 5.8L48 33.5" />
      <path d="M36 40.5l1.8 4.2 1.6-3.4 2 4.4 1.3-4.2" />
      {eye(40, 27.5, 2.1)}
      <path d="M37.2 26.2h5.6" strokeWidth="1.8" />
    </>
  ),
  // L6: moustache stripe and a yellow eye-ring
  "bot:falcon": () => (
    <>
      <path d={BUST} />
      <path d="M47.5 25.8c4.8-.3 7.3 2.5 6.8 6.4l-3-2-3.8 2.4" />
      <path d="M38.5 30.5c.8 4-.2 8-3.2 11" strokeWidth="3.4" />
      <circle cx="40.5" cy="27" r="3.6" stroke="#facc15" strokeWidth="1.8" />
      {eye(40.5, 27, 1.6)}
    </>
  ),
  // L7: cheek stripe, spotted chest, gold eye-ring
  "bot:kestrel": () => (
    <>
      <path d={BUST} />
      <path d="M47.5 26c4.5-.3 7 2.4 6.5 6.1l-2.8-1.9-3.7 2.3" />
      <path d="M38.8 31c.4 3-.6 5.6-2.2 7.4" />
      <circle cx="33" cy="45" r="1.2" fill={W} stroke="none" />
      <circle cx="37.5" cy="48.5" r="1.2" fill={W} stroke="none" />
      <circle cx="40.5" cy="43.5" r="1.2" fill={W} stroke="none" />
      <path d="M36 23.8l7.2-1.1" strokeWidth="1.8" />
      <circle cx="41" cy="27.5" r="3.7" stroke="#f7d24a" strokeWidth="1.8" />
      {eye(41, 27.5, 1.7)}
    </>
  ),
  // L8: gold beak, gold eye-ring, crowned
  "bot:blackbird": () => (
    <>
      <path d={BUST} />
      <path d="M48 26.8L56 29.8L48 32.8Z" fill="#f5b316" stroke="#f5b316" />
      <circle cx="40.5" cy="27.5" r="3.5" stroke="#f5b316" strokeWidth="1.8" />
      {eye(40.5, 27.5, 1.6)}
      <path d="M28.5 19.2l1.8-7 4.2 4.4 3.8-6.2 3.8 6.2 4.2-4.4 1.8 7c-6.3-1.6-13.3-1.6-19.6 0z" fill="#f5b316" stroke="#f5b316" strokeWidth="1.2" />
    </>
  ),
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

// the top bot wears gold; very dark bot colors get a lighter rim so the
// disc edge still shows on the dark theme
function ringFor(b, color) {
  if (b?.id === "bot:blackbird") return "#e0a414";
  return luminance(color) < 60 ? shade(color, 0.45) : shade(color, -0.35);
}

export function hasPortrait(id) {
  return !!BIRDS[id];
}

export default function BotAvatar({ bot, size = 32, sizeCss, locked = false, title }) {
  const uid = useId().replace(/:/g, "");
  const b = typeof bot === "string" ? botFor(bot) : bot;
  const Bird = b && BIRDS[b.id];
  const color = b?.color || "#8b8f97";
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
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 0.18)} />
          <stop offset="1" stopColor={shade(color, -0.3)} />
        </linearGradient>
        <clipPath id={`bc-${uid}`}>
          <circle cx="32" cy="32" r="27" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#bg-${uid})`} stroke={ringFor(b, color)} strokeWidth="3" />
      <path d="M9 26a23.5 23.5 0 0 1 46 0" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
      <g clipPath={`url(#bc-${uid})`} fill="none" stroke={W} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {Bird ? <Bird /> : <path d={BUST} />}
      </g>
    </svg>
  );
}
