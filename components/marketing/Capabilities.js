"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { count: 9, label: "Game Modes" },
  { count: 8, label: "Bot Opponents" },
  { count: 3, label: "Practice Drills" },
  { count: 1, label: "Connected Scoreboard" },
];

/** Four stat cards that count up once when scrolled into view. */
export default function Capabilities() {
  const region = useRef(null);
  const numbers = useRef([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = region.current;
    if (!el || !("IntersectionObserver" in window)) return undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, started = false;
    const finish = () => {
      cancelAnimationFrame(frame);
      numbers.current.forEach((n, i) => { if (n) n.textContent = String(STATS[i].count); });
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || started) return;
      started = true;
      observer.disconnect();
      setRevealed(true);
      if (motion.matches) { finish(); return; }
      const start = performance.now();
      const tick = (now) => {
        if (motion.matches || document.hidden) { finish(); return; }
        let complete = true;
        numbers.current.forEach((n, i) => {
          const progress = Math.min(1, Math.max(0, (now - start - i * 100) / 1000));
          if (n) n.textContent = String(Math.round(STATS[i].count * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) complete = false;
        });
        if (!complete) frame = requestAnimationFrame(tick);
        else finish();
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.25 });
    observer.observe(el);
    const onMotion = () => { if (motion.matches) finish(); };
    const onVisibility = () => { if (document.hidden && started) finish(); };
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-label="Blackbird Capabilities" className={`mk-capabilities${revealed ? " mk-stats-revealed" : ""}`} ref={region}>
      {STATS.map((s, i) => (
        <article aria-label={`${s.count} ${s.label}`} className="mk-stat-card" key={s.label}>
          <strong aria-hidden="true" className="mk-stat-count" data-count={s.count} ref={(el) => (numbers.current[i] = el)}>
            {s.count}
          </strong>
          <span aria-hidden="true">{s.label}</span>
        </article>
      ))}
    </div>
  );
}
