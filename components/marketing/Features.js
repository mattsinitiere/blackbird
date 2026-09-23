"use client";

import { usePreview } from "./PreviewProvider";

const FEATURES = [
  { icon: "↗", title: "Keep the Match Moving.", copy: "Enter each dart, follow the score, and undo a mis-tap. Blackbird handles the math so you can focus on the next throw.", panel: "scoring", cta: "Explore Scoring" },
  { icon: "⌁", title: "Get to Know Your Game.", copy: "Go beyond wins and losses with averages, checkout records, Cricket MPR, and player trends over time.", panel: "stats", cta: "Explore Player Stats" },
  { icon: "＋", title: "Put in the Practice.", copy: "Take on eight bot opponents or focus on doubles, checkouts, and scoring. Your practice log stays separate from competitive stats.", panel: "practice", cta: "Explore Practice" },
];

export default function Features() {
  const { setPanel } = usePreview();
  return (
    <section className="mk-section mk-features" id="features">
      <div className="mk-section-mark">
        <span>[ 02 / 05 ]</span>
      </div>
      <div className="mk-section-heading">
        <h2>
          The Game Is the Point.
          <br />
          <span>We’ll Keep the Score.</span>
        </h2>
        <p>
          Everything you need for a casual match, a competitive night,
          <br className="mk-desktop" /> or one more round of practice.
        </p>
      </div>
      <div className="mk-feature-grid">
        {FEATURES.map((f) => (
          <article key={f.panel}>
            <span aria-hidden="true" className="mk-feature-icon">
              {f.icon}
            </span>
            <h3>{f.title}</h3>
            <p>{f.copy}</p>
            <a className="mk-button mk-secondary mk-feature-button" href="#preview" onClick={() => setPanel(f.panel)}>
              {f.cta}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
