import Link from "next/link";
import DotGrid from "./DotGrid";
import ProductPreview from "./ProductPreview";
import Capabilities from "./Capabilities";

export default function Hero() {
  return (
    <section className="mk-hero mk-has-dot-grid">
      <DotGrid />
      <div className="mk-section-mark">
        <span>[ 01 / 05 ]</span>
      </div>
      <div className="mk-hero-copy">
        <h1>
          Every Dart Counts.
          <br />
          <span>Make Yours Matter.</span>
        </h1>
        <p>
          Less counting. More playing. Score the match, sharpen your
          <br className="mk-desktop" /> throw, and keep the rivalry going with Blackbird.
        </p>
        <div className="mk-hero-actions">
          <Link className="mk-button" href="/app">
            Open Blackbird
          </Link>
          <Link className="mk-button mk-secondary" href="/login">
            Sign In
          </Link>
        </div>
      </div>
      <ProductPreview />
      <Capabilities />
    </section>
  );
}
