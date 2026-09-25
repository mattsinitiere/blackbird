import { useState, useEffect } from "react";
import { getOccasion } from "@/lib/occasions";
import { Logo } from "@/components/ui";

// deterministic particle fields (no randomness → stable and reproducible)
const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  left: (i * 97) % 100,
  delay: ((i * 53) % 100) / 40, // 0–2.5s
  dur: 2.6 + ((i * 31) % 100) / 50, // 2.6–4.6s
  size: 6 + ((i * 13) % 3) * 2,
  color: ["var(--accent)", "var(--accent-glow)", "var(--amber)", "var(--red)", "var(--live)"][i % 5],
}));

const SNOW = Array.from({ length: 54 }, (_, i) => ({
  left: (i * 61) % 100,
  delay: ((i * 37) % 120) / 20, // 0–6s
  dur: 6 + ((i * 29) % 100) / 20, // 6–11s
  size: 3 + ((i * 17) % 4), // 3–6px
  op: 0.45 + ((i * 23) % 50) / 100,
}));

/** Tiny flat-vector party hat, perched on the wordmark on Sep 11. */
function PartyHat() {
  return (
    <svg className="load-hat" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 5 L31 34 L9 34 Z" fill="var(--accent)" />
      <circle cx="20" cy="5" r="3.6" fill="var(--amber)" />
    </svg>
  );
}

/**
 * Splash shown on every app open: the Blackbird mark inside a thin track
 * with a short arc sweeping around it (a dart's flight path), the mark
 * gently breathing, and the wordmark beneath. The logo files swap with the
 * theme (colour on light, white on dark) and the arc uses the accent. page.js keeps this up for 1–3 seconds per open (plus however
 * long auth/data actually take) so launching always has a moment of
 * perceived loading. Honors prefers-reduced-motion.
 *
 * Seasonal flourishes (lib/occasions.js): confetti + a party hat on
 * Sep 11, falling snow through December. Rendered only after mount so
 * server-prerendered HTML stays date-independent.
 */
export default function LoadingScreen({ text = "loading…" }) {
  const [occasion, setOccasion] = useState(null);
  useEffect(() => {
    setOccasion(getOccasion());
  }, []);

  return (
    <main className="app">
      {occasion === "birthday" && (
        <div className="load-fx" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="load-confetti"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.55,
                background: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      )}
      {occasion === "snow" && (
        <div className="load-fx" aria-hidden="true">
          {SNOW.map((f, i) => (
            <span
              key={i}
              className="load-flake"
              style={{
                left: `${f.left}%`,
                width: f.size,
                height: f.size,
                opacity: f.op,
                animationDuration: `${f.dur}s`,
                animationDelay: `${f.delay}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="load-wrap">
        <div className="load-mark">
          <svg className="load-orbit" viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="load-arc" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                <stop offset="1" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
            <circle className="load-track" cx="60" cy="60" r="56" />
            <circle className="load-arc" cx="60" cy="60" r="56" stroke="url(#load-arc)" />
            <circle className="load-tip" cx="60" cy="4" r="3.2" />
          </svg>
          <span className="load-icon">
            {occasion === "birthday" && <PartyHat />}
            <Logo variant="icon" height={76} />
          </span>
        </div>
        <div className="load-title">
          <Logo variant="word" height={30} />
        </div>
        <div className="load-status" role="status">
          {text}
        </div>
      </div>
    </main>
  );
}
