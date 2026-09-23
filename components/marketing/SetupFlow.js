"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  { num: "01", title: "Start Your Game", copy: "Open Blackbird on your phone.", icon: (<><rect height="38" rx="5" width="22" x="13" y="5" /><path d="M21 10h6M21 38h6M19 24l4 4 7-8" /></>) },
  { num: "02", title: "Connect Your TV", copy: "Choose Cast to TV and pair your room code.", icon: (<><path d="M18 8H9v9m21-9h9v9M9 31v9h9m21-9v9h-9M13 24h22" /><path d="M18 19l-5 5 5 5m12-10l5 5-5 5" /></>) },
  { num: "03", title: "Let Everyone Follow", copy: "Scores and results update on screen.", icon: (<><rect height="27" rx="4" width="38" x="5" y="8" /><path d="M17 41h14m-7-6v6M15 24l6-6 5 5 7-9" /></>) },
];

/**
 * Phone-to-TV setup steps with a travelling highlight. Runs only while on
 * screen, not paused, not hidden, and not under reduced motion.
 */
export default function SetupFlow() {
  const flow = useRef(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [blocked, setBlocked] = useState(false); // reduced motion or hidden tab

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setBlocked(reduced.matches || document.hidden);
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    let io;
    if ("IntersectionObserver" in window && flow.current) {
      io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { threshold: 0.15 });
      io.observe(flow.current);
    } else {
      setVisible(true);
    }
    return () => {
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      if (io) io.disconnect();
    };
  }, []);

  const running = visible && !paused && !blocked;
  return (
    <div className={`mk-tv-flow${running ? " mk-is-running" : ""}`} ref={flow}>
      <div className="mk-tv-flow-heading">
        <span>FROM YOUR PHONE TO THE BIG SCREEN</span>
        <button
          aria-label={paused ? "Play setup animation" : "Pause setup animation"}
          aria-pressed={paused}
          className="mk-flow-toggle"
          type="button"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Play animation" : "Pause animation"}
        </button>
      </div>
      <ol className="mk-tv-flow-steps">
        {STEPS.map((s) => (
          <li key={s.num}>
            <div aria-hidden="true" className="mk-flow-node">
              <svg fill="none" viewBox="0 0 48 48">{s.icon}</svg>
              <span>{s.num}</span>
            </div>
            <h3>{s.title}</h3>
            <p>{s.copy}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
