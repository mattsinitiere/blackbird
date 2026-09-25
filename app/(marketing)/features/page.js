import Link from "next/link";
import PageHero from "@/components/marketing/PageHero";
import Capabilities from "@/components/marketing/Capabilities";
import CTABand from "@/components/marketing/CTABand";
import { FEATURE_PAGES } from "@/lib/marketing/features";

export const metadata = {
  title: "Features",
  description: "Everything Blackbird does: dart scoring for nine games, AI coaching and training plans, practice drills and bots, stats, matchups and achievements.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PageHero
        eyebrow="THE WHOLE KIT"
        title={["Everything Around the Board.", "In One Place."]}
        intro="Score the match, study your game, and put in the practice. Here’s what Blackbird does, and where to read more."
        actions={[{ href: "/app", text: "Open Blackbird" }]}
      />
      <section className="mk-section">
        <div className="mk-feature-grid mk-feature-grid-4">
          {FEATURE_PAGES.map((p) => (
            <article key={p.slug}>
              <span aria-hidden="true" className="mk-feature-icon">
                {p.icon}
              </span>
              <h2 className="mk-card-title">
                {p.nav}
                {p.isNew && <span className="mk-new-tag">New</span>}
              </h2>
              <p>{p.card}</p>
              <Link className="mk-button mk-secondary mk-feature-button" href={`/features/${p.slug}`}>
                Explore {p.nav}
              </Link>
            </article>
          ))}
        </div>
        <Capabilities />
      </section>
      <section className="mk-section mk-link-strip">
        <Link href="/games">
          <span className="mk-label mk-blue">GAME MODES</span>
          <strong>Nine games, from X01 to Tic-Tac-Toe</strong>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/tv-mode">
          <span className="mk-label mk-blue">TV MODE</span>
          <strong>Put the scoreboard on the big screen</strong>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
      <CTABand />
    </main>
  );
}
