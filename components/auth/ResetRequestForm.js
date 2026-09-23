"use client";

import { useState } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import AuthCard, { NotConfigured, FormMessage } from "./AuthCard";

export default function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isConfigured) return <NotConfigured />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return setMsg("Enter your email.");
    setBusy(true);
    setMsg("");
    try {
      // The response is the same whether or not the address has an account,
      // so the form cannot be used to check who is a member.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset/confirm`,
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your email" links={[{ href: "/login", label: "Back to sign in" }]}>
        <p className="subtle" style={{ marginBottom: 0 }}>
          If <strong>{email.trim()}</strong> has a Blackbird account, a reset link is on its way. The link is good for a short while.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" links={[{ href: "/login", label: "Back to sign in" }]}>
      <form onSubmit={submit} className="stack-8" noValidate>
        <input
          className="input"
          type="email"
          placeholder="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
        <FormMessage>{msg}</FormMessage>
        <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy}>
          {busy ? "…" : "Email me a reset link"}
        </button>
      </form>
    </AuthCard>
  );
}
