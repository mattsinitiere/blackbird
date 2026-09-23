import Link from "next/link";
import DotGrid from "./DotGrid";

export default function Closing() {
  return (
    <section className="mk-closing mk-has-dot-grid">
      <DotGrid />
      <span className="mk-label mk-blue">NEXT THROW. NEW POSSIBILITIES.</span>
      <h2>Meet You at the Board.</h2>
      <Link className="mk-button" href="/app">
        Open Blackbird
      </Link>
    </section>
  );
}
