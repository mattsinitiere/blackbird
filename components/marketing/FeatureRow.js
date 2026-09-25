import Link from "next/link";

/** One feature on an inner page: copy and bullets beside a mock visual, alternating sides. */
export default function FeatureRow({ index, label, title, copy, points = [], link, children }) {
  return (
    <section className={`mk-section mk-feature-row${index % 2 ? " mk-flip" : ""}`}>
      <div className="mk-feature-copy">
        <span className="mk-label mk-blue">{label}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
        {points.length > 0 && (
          <ul className="mk-points">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {link && (
          <Link className="mk-text-link" href={link.href}>
            {link.text} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <div className="mk-feature-visual">{children}</div>
    </section>
  );
}
