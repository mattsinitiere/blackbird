import { useId } from "react";
import { botFor } from "@/lib/bots";

/**
 * Bot portraits: each bot is a bird character that matches its name, drawn
 * as flat vector shapes on a disc tinted from the bot's colour, with a
 * ring in that colour. Profile view facing right; the same bust silhouette
 * and eye for every bird so the set reads as one family. Pure SVG, no
 * images, so it stays sharp from a 20px scoreboard chip to a 96px hero.
 */

// shared bust silhouette: shoulders at the bottom, head top-centre, facing right
const BUST = "M10 66C10 52 13 42 20 35C24 25 31 20 39 20C47 20 52 26 52 33C52 39 49 44 47 48C51 53 54 59 54 66Z";
const Eye = ({ x = 42, y = 30, r = 3, ring = null, lid = false, look = 0.9 }) => (
  <g>
    {ring && <circle cx={x} cy={y} r={r + 1.6} fill={ring} />}
    <circle cx={x} cy={y} r={r} fill="#fff" />
    <circle cx={x + look} cy={y} r={r * 0.55} fill="#111" />
    <circle cx={x + look + 0.6} cy={y - 0.8} r={r * 0.18} fill="#fff" />
    {lid && <path d={`M${x - r - 0.5} ${y - 0.6}h${2 * r + 1}`} stroke="#111" strokeWidth="1.8" strokeLinecap="round" />}
  </g>
);

const BIRDS = {
  // L1: a young rook, pale bare face, a little lost, learner plate on
  "bot:rook": () => (
    <>
      <path d={BUST} fill="#34373e" />
      <ellipse cx="48" cy="33" rx="6" ry="5.5" fill="#d8d2c8" />
      <path d="M50 29L62 33.5L50 37Z" fill="#bdb6ab" />
      <Eye x={41} y={29} r={3.2} look={-0.6} />
      <rect x="15" y="47" width="12" height="12" rx="2" fill="#fff" stroke="#d63a3a" strokeWidth="1.2" />
      <path d="M19 50v6.2h5" fill="none" stroke="#d63a3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // L2: round brown pub sparrow with a black bib and pale cheek
  "bot:sparrow": () => (
    <>
      <path d={BUST} fill="#a8774b" />
      <path d="M22 33C25 24 32 20 39 20C45 20 49 23 51 27C44 25 36 27 30 33Z" fill="#7a5433" />
      <ellipse cx="39" cy="37" rx="7" ry="5" fill="#efe3cf" />
      <path d="M47 39C50 42 49 47 46 49C44 46 44 42 47 39Z" fill="#2b2522" />
      <path d="M50 30L58 33.5L50 37Z" fill="#3b302a" />
      <Eye x={43} y={30} r={2.8} />
    </>
  ),
  // L3: blue jay, crest up, black necklace
  "bot:jay": () => (
    <>
      <path d={BUST} fill="#3f7fe0" />
      <path d="M22 32L11 17L25 24L22 11L32 21L35 13L40 22Z" fill="#3f7fe0" />
      <path d="M36 32C40 29 47 29 52 33C51 39 49 43 46 47C41 45 37 39 36 32Z" fill="#f3f6fb" />
      <path d="M33 49C39 53 45 52 48 46" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M50 30L59 33.5L50 37Z" fill="#161616" />
      <Eye x={43} y={30} r={2.8} />
      <path d="M16 56l6-3M17 61l7-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // L4: magpie, black and white with a green-blue sheen, eyeing a glint
  "bot:magpie": () => (
    <>
      <path d={BUST} fill="#141619" />
      <path d="M10 66C10 56 12 49 16 44C22 47 28 53 31 66Z" fill="#f7f7f5" />
      <path d="M24 31C29 23 37 20 45 22" fill="none" stroke="#2dd4bf" strokeOpacity="0.75" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M50 30L60 33L50 36.5Z" fill="#0b0b0b" />
      <Eye x={42} y={29} r={2.7} look={1.3} />
      <path d="M55 19l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="#fbbf24" />
    </>
  ),
  // L5: raven, heavy beak, shaggy throat, unbothered sideways look
  "bot:raven": () => (
    <>
      <path d={BUST} fill="#15121c" />
      <path d="M26 30C31 23 38 21 46 23" fill="none" stroke="#8b5cf6" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M49 27C57 27 63 31 61 35.5L49 38Z" fill="#26232b" />
      <path d="M38 45l2.5 6 2-4.5 2.5 5.5 1.5-5.5 2.5 3" fill="none" stroke="#15121c" strokeWidth="3" strokeLinejoin="round" />
      <Eye x={41} y={29} r={2.8} lid look={1.4} />
    </>
  ),
  // L6: peregrine falcon, dark moustache stripe, yellow eye-ring and cere
  "bot:falcon": () => (
    <>
      <path d={BUST} fill="#4a5568" />
      <path d="M34 38C38 34 45 34 50 38C49 44 47 48 45 50C39 49 35 44 34 38Z" fill="#f4ecdd" />
      <path d="M40 33C41 39 40 44 36 48" fill="none" stroke="#1f2430" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M49 28C56 28 59 32 58 37L54 34.5L49 37Z" fill="#2c313b" />
      <path d="M48.5 28.5l3 0.2-.6 3.2-2.6.3z" fill="#facc15" />
      <Eye x={42} y={29} r={2.8} ring="#facc15" />
      <path d="M40 46l1.5 1.5M44 45l1.5 1.5M42 49l1.5 1.5" stroke="#4a5568" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  // L7: kestrel, blue-grey head, rufous body, spotted chest, locked-on stare
  "bot:kestrel": () => (
    <>
      <path d={BUST} fill="#c4552d" />
      <path d="M20 35C24 25 31 20 39 20C47 20 52 26 52 33C52 37 51 40 49 43C42 40 30 38 20 35Z" fill="#7185a8" />
      <path d="M33 42C38 40 45 41 49 44C48 50 45 55 40 58C35 55 33 49 33 42Z" fill="#f2dcc0" />
      <circle cx="38" cy="48" r="1.2" fill="#3a2418" /><circle cx="42" cy="52" r="1.2" fill="#3a2418" /><circle cx="44" cy="47" r="1.2" fill="#3a2418" />
      <path d="M41 33.5C41.5 37 40.5 40 38.5 42" fill="none" stroke="#26303f" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M49 28.5C56 28.5 58 32 57 36.5L53.5 34L49 36.5Z" fill="#2a2d33" />
      <path d="M38 25.5l7-1.2" stroke="#26303f" strokeWidth="1.8" strokeLinecap="round" />
      <Eye x={42} y={29.5} r={3} ring="#f7d24a" look={1.2} />
    </>
  ),
  // L8: the Blackbird, glossy black, golden beak and eye-ring, crowned
  "bot:blackbird": () => (
    <>
      <path d={BUST} fill="#0c0c10" />
      <path d="M25 30C30 23 37 21 45 22" fill="none" stroke="#6366f1" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50 29.5L61 33.5L50 37Z" fill="#f5b316" />
      <Eye x={42} y={29.5} r={2.7} ring="#f5b316" />
      <path d="M27 20.5l2.4-8.5 5 5.5 4.6-7.5 4.6 7.5 5-5.5 2.4 8.5c-7-2.2-16.8-2.2-24 0z" fill="#f5b316" stroke="#b7800a" strokeWidth="1" strokeLinejoin="round" />
    </>
  ),
};

function tint(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
}

// the top bot wears gold; very dark bot colours get a lighter ring so the
// disc edge still shows on the dark theme
function ringFor(b, color) {
  if (b?.id === "bot:blackbird") return "#e0a414";
  return luminance(color) < 60 ? tint(color, 0.4) : color;
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
        <clipPath id={`ba-${uid}`}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill={tint(color, 0.78)} />
      <g clipPath={`url(#ba-${uid})`}>{Bird ? <Bird /> : <path d={BUST} fill={color} />}</g>
      <circle cx="32" cy="32" r="30" fill="none" stroke={ringFor(b, color)} strokeWidth="3.2" />
    </svg>
  );
}
