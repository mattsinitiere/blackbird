import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mk-wrap">
      <div>
        <Link aria-label="Blackbird home" className="mk-brand" href="/">
          <img alt="Blackbird Dart Scoring System" height="60" src="/brand/lockup-color.svg" width="211" />
        </Link>
      </div>
      <div className="mk-footer-right">
        <a href="/#features">The Product</a>
        <a href="/#questions">Questions</a>
        <Link href="/app">Play</Link>
        <span>© 2026 Sinitiere Labs</span>
      </div>
      <nav aria-label="Legal and developer" className="mk-footer-legal">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Use</Link>
        <a href="https://github.com/mattsinitiere/blackbird" rel="noopener">
          Developer
        </a>
      </nav>
    </footer>
  );
}
