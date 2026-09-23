import Link from "next/link";
import AuthNav from "./AuthNav";

export default function MarketingHeader() {
  return (
    <header>
      <nav aria-label="Main navigation" className="mk-nav mk-wrap">
        <Link aria-label="Blackbird home" className="mk-brand" href="/">
          <img alt="Blackbird Dart Scoring System" height="60" src="/brand/lockup-color.svg" width="211" />
        </Link>
        <div className="mk-nav-links">
          <a href="/#features">Features</a>
          <a href="/#games">Game Modes</a>
          <a href="/#tv">TV Mode</a>
          <a href="/#questions">FAQs</a>
        </div>
        <AuthNav />
      </nav>
    </header>
  );
}
