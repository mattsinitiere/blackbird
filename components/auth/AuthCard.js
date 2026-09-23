"use client";

import Link from "next/link";
import { Logo } from "@/components/ui";

/**
 * Shared chrome for the sign-in, sign-up and password pages: brand header,
 * one card, optional links under it, and the footer line.
 */
export default function AuthCard({ title, children, links = [] }) {
  return (
    <>
      <div className="header" style={{ justifyContent: "center" }}>
        <Link href="/" aria-label="Blackbird home" style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}>
          <Logo size={40} />
          <div>
            <div className="brand-title">Blackbird</div>
            <div className="tag" style={{ marginTop: 2 }}>
              Dart Scoring System
            </div>
          </div>
        </Link>
      </div>

      <div className="card fade">
        {title && (
          <h1 className="section-title" style={{ marginTop: 0, marginBottom: 14 }}>
            {title}
          </h1>
        )}
        {children}
      </div>

      {links.length > 0 && (
        <p
          className="tag"
          style={{ marginTop: 14, textAlign: "center", textTransform: "none", letterSpacing: 0, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ color: "var(--accent)", fontWeight: 700 }}>
              {l.label}
            </Link>
          ))}
        </p>
      )}

      <p className="tag" style={{ marginTop: 16, textAlign: "center", textTransform: "none", letterSpacing: 0 }}>
        © 2026 Sinitiere Labs
      </p>
    </>
  );
}

/** Shown on auth pages when the Supabase environment is missing. */
export function NotConfigured() {
  return (
    <AuthCard title="Setup needed">
      <p className="subtle" style={{ marginBottom: 0 }}>
        Supabase isn&apos;t configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, then rebuild.
      </p>
    </AuthCard>
  );
}

/** One-line status or error under a form. */
export function FormMessage({ children, tone = "error" }) {
  if (!children) return null;
  return (
    <p className="subtle" style={{ color: tone === "error" ? "var(--red)" : "var(--accent)", marginBottom: 0 }} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}
