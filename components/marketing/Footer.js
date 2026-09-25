import Link from "next/link";
import { FEATURE_PAGES } from "@/lib/marketing/features";

const COLUMNS = [
  { title: "Product", links: [{ href: "/features", label: "All Features" }, ...FEATURE_PAGES.map((p) => ({ href: `/features/${p.slug}`, label: p.nav }))] },
  { title: "Play", links: [{ href: "/games", label: "Game Modes" }, { href: "/tv-mode", label: "TV Mode" }, { href: "/app", label: "Open Blackbird" }] },
  { title: "Help", links: [{ href: "/faq", label: "FAQs" }, { href: "/privacy", label: "Privacy Policy" }, { href: "/terms", label: "Terms of Use" }] },
];

export default function Footer() {
  return (
    <footer className="mk-wrap">
      <div className="mk-footer-brand">
        <Link aria-label="Blackbird home" className="mk-brand" href="/">
          <img alt="Blackbird Dart Scoring System" height="60" src="/brand/lockup-color.svg" width="211" />
        </Link>
        <p>© 2026 Sinitiere Labs</p>
      </div>
      <nav aria-label="Site map" className="mk-footer-columns">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2>{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
              {col.title === "Help" && (
                <li>
                  <a href="https://github.com/mattsinitiere/blackbird" rel="noopener">
                    Developer
                  </a>
                </li>
              )}
            </ul>
          </div>
        ))}
      </nav>
    </footer>
  );
}
