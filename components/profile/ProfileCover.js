import { coverId } from "@/lib/covers";

/**
 * Profile cover designs (lib/covers.js). Each is flat vector art in the
 * brand's colours behind the Blackbird mark. `mini` renders the small
 * preview used by the picker in Settings. Decorative only.
 */

// dartboard geometry, centred at (0, 0)
function wedge(r0, r1, a0, a1) {
  const p = (r, a) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
  return `M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
}
const STEP = (Math.PI * 2) / 20;
const WEDGES = Array.from({ length: 20 }, (_, i) => i).filter((i) => i % 2 === 0).map((i) => wedge(28, 170, -Math.PI / 2 - STEP / 2 + i * STEP, -Math.PI / 2 + STEP / 2 + i * STEP));

// fixed star field (no randomness: stable across renders)
const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 173) % 600, y: 10 + ((i * 67) % 130), r: 0.6 + ((i * 7) % 3) * 0.45, o: 0.35 + ((i * 11) % 5) / 10 }));

// wobbly concentric rings (fixed, so stable across renders)
const CONTOURS = Array.from({ length: 11 }, (_, k) => {
  const i = k + 1;
  const r = i * 20;
  return {
    d: `M${480 - r} 90c${r * 0.3} ${-r * 0.9} ${r * 1.6} ${-r * 0.85} ${r * 2} ${-r * 0.1}s${-r * 0.4} ${r * 1.1} ${-r * 1.1} ${r * 0.95}S${480 - r - 10} ${90 + r * 0.4} ${480 - r} 90z`,
    o: +(0.16 - i * 0.011).toFixed(3),
  };
});

function Art({ id }) {
  switch (id) {
    case "dartboard":
      return (
        <g transform="translate(470 120)">
          <circle r="190" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="16" />
          {WEDGES.map((d, i) => (
            <path key={i} d={d} fill="#fff" fillOpacity="0.06" />
          ))}
          <circle r="170" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="2" />
          <circle r="104" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="10" />
          <circle r="28" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="2" />
          <circle r="11" fill="#fff" fillOpacity="0.18" />
        </g>
      );
    case "flight":
      return (
        <g fill="none" stroke="#fff" strokeLinecap="round">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${120 + i * 70} ${170 + i * 6}L${330 + i * 70} ${-10 + i * 6}`} strokeOpacity={0.05 + i * 0.015} strokeWidth={10 - i} />
          ))}
          <path d="M60 150C200 20 380 10 540 70" strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="2 12" />
          <g transform="translate(540 70) rotate(22)" strokeOpacity="0.55" strokeWidth="2.5">
            <path d="M0 0l-16-5M0 0l-16 5M-16 -5l-22 0M-16 5l-22 0M-38 0l-10-8M-38 0l-10 8" />
          </g>
        </g>
      );
    case "scoreboard":
      return (
        <g fill="#fff" fontFamily="var(--font-display-stack)" fontWeight="800">
          <text x="600" y="92" textAnchor="end" fontSize="84" fillOpacity="0.13" letterSpacing="-2">180 · 140 · 100</text>
          <g stroke="#fff" strokeOpacity="0.22" strokeWidth="4" strokeLinecap="round" fill="none">
            {[0, 1].map((g) => (
              <g key={g} transform={`translate(${250 + g * 90} 118)`}>
                <path d="M0 0v28M12 0v28M24 0v28M36 0v28M-6 24L44 4" />
              </g>
            ))}
          </g>
          <path d="M0 150h600" stroke="#fff" strokeOpacity="0.08" strokeWidth="2" />
        </g>
      );
    case "night":
      return (
        <g>
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity={s.o} />
          ))}
          {/* birds in flight: two wing arcs meeting at the body */}
          <path d="M360 92c10-14 24-18 36-8 12-10 26-6 36 8-12-4-24-2-36 8-12-10-24-12-36-8z" fill="#fff" fillOpacity="0.75" />
          <path d="M448 62c6-8 14-10 21-5 7-5 15-3 21 5-7-2-14-1-21 5-7-6-14-7-21-5z" fill="#fff" fillOpacity="0.5" />
          <circle cx="520" cy="44" r="18" fill="#fff" fillOpacity="0.14" />
        </g>
      );
    case "contours":
      // topographic rings rippling out from a bullseye on the right
      return (
        <g fill="none" stroke="#fff">
          {CONTOURS.map((c, i) => (
            <path key={i} d={c.d} strokeOpacity={c.o} strokeWidth="1.6" />
          ))}
          <circle cx="490" cy="84" r="5" fill="#fff" fillOpacity="0.35" stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

export default function ProfileCover({ cover, mini = false }) {
  const id = coverId(cover);
  return (
    <div className={`pf-cover pf-cover--${id}${mini ? " pf-cover-mini" : ""}`} aria-hidden="true">
      {id !== "playon" && (
        <svg className="pf-cover-art" viewBox="0 0 600 160" preserveAspectRatio="xMaxYMid slice">
          <Art id={id} />
        </svg>
      )}
      {id === "playon" && <span className="pf-cover-kicker">EVERY DART COUNTS.</span>}
      <img className="pf-cover-mark" src="/brand/icon-white.svg" alt="" width="30" height="30" />
      {id === "playon" && <span className="pf-cover-big">PLAY ON.</span>}
    </div>
  );
}
