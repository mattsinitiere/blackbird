import Link from "next/link";

/** The opening block of every inner page: eyebrow, two-line heading, intro and optional buttons. */
export default function PageHero({ eyebrow, title, intro, actions = [] }) {
  return (
    <section className="mk-page-hero">
      <span className="mk-label mk-blue">{eyebrow}</span>
      <h1>
        {title[0]}
        <br />
        <span>{title[1]}</span>
      </h1>
      <p>{intro}</p>
      {actions.length > 0 && (
        <div className="mk-hero-actions">
          {actions.map((a, i) => (
            <Link key={a.href} className={`mk-button${i > 0 ? " mk-secondary" : ""}`} href={a.href}>
              {a.text}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
