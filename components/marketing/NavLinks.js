"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV, isCurrent } from "@/lib/marketing/nav";

function Items({ pathname, onNavigate }) {
  return NAV.map((item) => (
    <Link key={item.href} aria-current={isCurrent(item.href, pathname) ? "page" : undefined} href={item.href} onClick={onNavigate}>
      {item.label}
      {item.isNew && <span className="mk-new-tag">New</span>}
    </Link>
  ));
}

/** Header links with the current page marked, plus a disclosure menu below 720px. */
export default function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  const panel = useRef(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e) => {
      if (!panel.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  return (
    <>
      <div className="mk-nav-links">
        <Items pathname={pathname} />
      </div>
      <button
        ref={button}
        aria-controls="mk-menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="mk-menu-button"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true" className={`mk-menu-icon${open ? " mk-is-open" : ""}`} />
      </button>
      <nav ref={panel} aria-label="Site pages" className="mk-menu" hidden={!open} id="mk-menu">
        <Items pathname={pathname} onNavigate={() => setOpen(false)} />
        <Link href="/app" onClick={() => setOpen(false)}>
          Open Blackbird <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </>
  );
}
