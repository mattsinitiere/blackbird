import { MERLIN } from "@/lib/merlin";

/** Merlin's wizard-hat mark, line art in the card's accent color. */
function HatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h18" />
      <path d="M6 20l5.2-15.4a.9.9 0 0 1 1.6 0L18 20" />
      <path d="M8.3 13.5h7.4" />
      <path d="M17.5 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  );
}

/**
 * Merlin on Home: one headline, a sentence or two, one primary action and
 * at most one secondary. Content comes from lib/merlin.js merlinState
 * (deterministic, no AI call); this only draws it and maps actions.
 */
export default function MerlinCard({ card, onAction }) {
  if (!card) return null;
  const loading = card.state === "loading";
  return (
    <section className={`card mb-12 merlin${loading ? " is-loading" : ""}`} aria-label={`${MERLIN.name}, ${MERLIN.tagline}`} aria-busy={loading}>
      <div className="merlin-head">
        <span className="merlin-icon">
          <HatIcon />
        </span>
        <div className="merlin-id">
          <span className="merlin-name">{MERLIN.name}</span>
          <span className="merlin-tag">{MERLIN.tagline}</span>
        </div>
      </div>
      <h3 className="merlin-headline">{card.headline}</h3>
      {card.body && <p className="merlin-body">{card.body}</p>}
      {card.note && <p className="merlin-note">{card.note}</p>}
      {!loading && (card.primary || card.secondary) && (
        <div className="merlin-actions">
          {card.primary && (
            <button type="button" className="btn btn-primary" onClick={() => onAction(card.primary)}>
              {card.primary.label}
            </button>
          )}
          {card.secondary && (
            <button type="button" className="btn" onClick={() => onAction(card.secondary)}>
              {card.secondary.label}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
