/** Main navigation for the public site, shared by the header and footer. */
export const NAV = [
  { href: "/features", label: "Features" },
  { href: "/features/coaching", label: "Coaching", isNew: true },
  { href: "/games", label: "Game Modes" },
  { href: "/tv-mode", label: "TV Mode" },
  { href: "/faq", label: "FAQs" },
];

/** A nav item is current on its own page; /features also on its sub-pages except Coaching, which has its own link. */
export function isCurrent(href, pathname) {
  if (!pathname) return false;
  if (href === "/features") return pathname === "/features" || (pathname.startsWith("/features/") && pathname !== "/features/coaching");
  return pathname === href;
}
