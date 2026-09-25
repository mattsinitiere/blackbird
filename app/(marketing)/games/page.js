import Link from "next/link";
import PageHero from "@/components/marketing/PageHero";
import CTABand from "@/components/marketing/CTABand";
import { GAMES } from "@/lib/marketing/games";

export const metadata = {
  title: "Game Modes",
  description: "Nine dart games in one scorer: X01, Cricket, Baseball, Around the Clock, Killer, Shanghai, Halve It, Gotcha and Tic-Tac-Toe.",
  alternates: { canonical: "/games" },
};

const slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function GamesPage() {
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PageHero
        eyebrow="SAME BOARD. NEW POSSIBILITIES."
        title={["Your Classics.", "Your New Favorites."]}
        intro="Nine game modes, with options for competitive matches and casual play. Blackbird knows the rules, so you don’t have to argue about them."
        actions={[{ href: "/app", text: "Start a Game" }]}
      />
      <nav aria-label="Jump to a game" className="mk-section mk-game-options mk-game-jump">
        {GAMES.map((g) => (
          <a key={g.id} href={`#${slug(g.id)}`}>
            {g.id}
          </a>
        ))}
      </nav>
      <section className="mk-section mk-game-grid" aria-label="All game modes">
        {GAMES.map((g) => (
          <article key={g.id} id={slug(g.id)}>
            <span className="mk-label mk-blue">{g.eyebrow}</span>
            <h2>{g.id}</h2>
            <h3>{g.title}</h3>
            <p>{g.copy}</p>
            <p>{g.how}</p>
            <span className="mk-pill">{g.players.toUpperCase()}</span>
          </article>
        ))}
      </section>
      <section className="mk-section mk-link-strip">
        <Link href="/features/practice">
          <span className="mk-label mk-blue">PRACTICE</span>
          <strong>Bob’s 27, checkout drills, scoring drills, and eight bots</strong>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/features/coaching">
          <span className="mk-label mk-blue">STRATEGY HINTS</span>
          <strong>Checkout routes for X01 and hints for Cricket</strong>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
      <CTABand label="PICK YOUR GAME" title="Who’s Throwing First?" href="/app" text="Start a Game" />
    </main>
  );
}
