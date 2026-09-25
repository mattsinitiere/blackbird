import Link from "next/link";
import AuthNav from "./AuthNav";
import NavLinks from "./NavLinks";

export default function MarketingHeader() {
  return (
    <header>
      <nav aria-label="Main navigation" className="mk-nav mk-wrap">
        <Link aria-label="Blackbird home" className="mk-brand" href="/">
          <img alt="Blackbird Dart Scoring System" height="60" src="/brand/lockup-color.svg" width="211" />
        </Link>
        <NavLinks />
        <AuthNav />
      </nav>
    </header>
  );
}
