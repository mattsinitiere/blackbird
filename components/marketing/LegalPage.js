import Link from "next/link";

export default function LegalPage({ title, prepared, children }) {
  return (
    <main className="mk-wrap mk-main-frame mk-legal-page" id="main">
      <Link className="mk-legal-back" href="/">
        Back to Blackbird
      </Link>
      <h1>{title}</h1>
      <aside className="mk-legal-draft">
        <strong>Draft for Review — Not Yet Effective</strong>
        <p>{prepared}</p>
      </aside>
      <article className="mk-legal-content">{children}</article>
    </main>
  );
}
