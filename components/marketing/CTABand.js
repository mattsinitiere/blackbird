import Link from "next/link";
import DotGrid from "./DotGrid";

/** The closing call to action at the foot of each page. */
export default function CTABand({ label = "NEXT THROW. NEW POSSIBILITIES.", title = "Meet You at the Board.", href = "/app", text = "Open Blackbird" }) {
  return (
    <section className="mk-closing mk-has-dot-grid">
      <DotGrid />
      <span className="mk-label mk-blue">{label}</span>
      <h2>{title}</h2>
      <Link className="mk-button" href={href}>
        {text}
      </Link>
    </section>
  );
}
