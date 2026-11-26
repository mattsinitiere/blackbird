"use client";

import { useState } from "react";
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
        <Link href="/" aria-label="Blackbird home" style={{ display: "flex", alignItems: "center" }}>
          <Logo variant="lockup" height={48} />
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
        <p style={{ margin: "8px 0 0", display: "flex", justifyContent: "center", columnGap: 8, flexWrap: "wrap" }}>
          {links.map((l) => (
            // full 44px tap targets, not 13px lines of text
            <Link
              key={l.href}
              href={l.href}
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 10px", color: "var(--accent)", fontWeight: 600, fontSize: "calc(14px * var(--fs))", textDecoration: "none" }}
            >
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

/** A form field with a visible label above it (placeholders vanish as you type). */
export function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", marginBottom: 5, color: "var(--ink-soft)", fontSize: "calc(13px * var(--fs))", fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** A password input with a Show / Hide button, to check what was typed on a phone. */
export function PasswordInput({ style, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} className="input" type={shown ? "text" : "password"} style={{ ...style, paddingRight: 72 }} />
      <button
        type="button"
        aria-pressed={shown}
        aria-label="Show password"
        onClick={() => setShown((v) => !v)}
        style={{ position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)", minWidth: 60, minHeight: 44, border: 0, background: "none", color: "var(--accent)", font: "inherit", fontSize: "calc(13px * var(--fs))", fontWeight: 700, cursor: "pointer" }}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
