import Link from "next/link";
import PageHero from "@/components/marketing/PageHero";
import CTABand from "@/components/marketing/CTABand";
import TVPreview from "@/components/marketing/TVPreview";
import SetupFlow from "@/components/marketing/SetupFlow";

export const metadata = {
  title: "TV Mode",
  description: "Put a live darts scoreboard on any TV. Score from your phone, pair the TV with a four-character room code, and everyone follows the match.",
  alternates: { canonical: "/tv-mode" },
};

const WAYS = [
  { title: "Smart TV browser", copy: "Open Blackbird’s TV page in the browser on your smart TV." },
  { title: "AirPlay", copy: "Open the TV page in Safari on a Mac, iPhone, or iPad and AirPlay the window to your TV." },
  { title: "Chromecast", copy: "Open the TV page in Chrome on a computer and cast the tab." },
];

export default function TVModePage() {
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PageHero
        eyebrow="TV MODE"
        title={["Give the Whole Room", "a Front-Row Seat."]}
        intro="Score from your phone. Pair a TV with your room code. Everyone follows the match up on the big screen."
        actions={[{ href: "/tv", text: "Open the TV Page" }, { href: "/app", text: "Start a Game" }]}
      />
      <section className="mk-section mk-tv">
        <TVPreview />
        <SetupFlow />
      </section>
      <section className="mk-section">
        <div className="mk-section-heading">
          <span className="mk-label mk-blue">WHATEVER’S ON THE WALL</span>
          <h2>Three Ways to Get on Screen.</h2>
          <p>No app to install on the TV. If it has a browser, or you can cast to it, it works.</p>
        </div>
        <div className="mk-feature-grid">
          {WAYS.map((w) => (
            <article key={w.title}>
              <h3>{w.title}</h3>
              <p>{w.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mk-section mk-link-strip">
        <Link href="/faq">
          <span className="mk-label mk-blue">QUESTIONS</span>
          <strong>How pairing works, and other things to know</strong>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/games">
          <span className="mk-label mk-blue">GAME MODES</span>
          <strong>Nine games to put on the big screen</strong>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
      <CTABand label="GAME NIGHT" title="Turn On the TV." />
    </main>
  );
}
