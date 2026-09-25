import Link from "next/link";

/**
 * A legal page. Pass `effective` (and optionally `updated`) once the text is
 * final; without it the page shows the draft banner with `prepared`.
 */
export default function LegalPage({ title, prepared, effective, updated, children }) {
  return (
    <main className="mk-wrap mk-main-frame mk-legal-page" id="main">
      <Link className="mk-legal-back" href="/">
        Back to Blackbird
      </Link>
      <h1>{title}</h1>
      {effective ? (
        <p className="mk-legal-dates">
          Effective {effective}
          {updated && updated !== effective ? ` · Last updated ${updated}` : ""}
        </p>
      ) : (
        <aside className="mk-legal-draft">
          <strong>Draft for Review — Not Yet Effective</strong>
          <p>{prepared}</p>
        </aside>
      )}
      <article className="mk-legal-content">{children}</article>
    </main>
  );
}
