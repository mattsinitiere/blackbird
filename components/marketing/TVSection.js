import Link from "next/link";
import TVPreview from "./TVPreview";
import SetupFlow from "./SetupFlow";

export default function TVSection() {
  return (
    <section className="mk-section mk-tv" id="tv">
      <div className="mk-section-mark">
        <span>[ 04 / 05 ]</span>
      </div>
      <div className="mk-section-heading">
        <h2>
          Give the Whole Room
          <br />
          <span>a Front-Row Seat.</span>
        </h2>
        <p>
          Score from your phone. Pair a TV with your room code.
          <br className="mk-desktop" /> Everyone follows the match up on the big screen.
        </p>
      </div>
      <TVPreview />
      <SetupFlow />
      <p className="mk-section-more">
        <Link className="mk-text-link" href="/tv-mode">
          More about TV Mode <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}
