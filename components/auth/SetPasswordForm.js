"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import AuthCard, { NotConfigured, FormMessage } from "./AuthCard";

const MIN_PASSWORD = 6;

/**
 * Choose a password after arriving from an emailed link: an invite
 * (mode "invite") or a password reset (mode "reset"). Supabase consumes the
 * token in the URL and opens a session; only then is the form shown.
 */
export default function SetPasswordForm({ mode = "reset" }) {
  const router = useRouter();
  const [phase, setPhase] = useState("waiting"); // waiting | ready | expired
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // an expired or reused link comes back as #error=...&error_description=...
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      setLinkError(hash.get("error_description") || "");
      setPhase("expired");
      return;
    }
    let settled = false;
    const arm = () => {
      settled = true;
      setPhase("ready");
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s) arm();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) arm();
    });
    const t = setTimeout(() => {
      if (!settled) setPhase("expired");
    }, 8000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isConfigured) return <NotConfigured />;

  const backHref = mode === "invite" ? "/signup" : "/reset";
  const backLabel = mode === "invite" ? "Request a new invite" : "Request a new reset link";

  if (phase === "expired") {
    return (
      <AuthCard title="Link expired" links={[{ href: backHref, label: backLabel }, { href: "/login", label: "Sign in" }]}>
        <p className="subtle" style={{ marginBottom: 0 }}>
          This link is invalid or has expired.{linkError ? ` (${linkError.replace(/\+/g, " ")})` : ""}
        </p>
      </AuthCard>
    );
  }

  if (phase === "waiting") {
    return (
      <AuthCard title={mode === "invite" ? "Welcome to Blackbird" : "Reset password"}>
        <p className="subtle" style={{ marginBottom: 0 }} role="status">
          Checking your link…
        </p>
      </AuthCard>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setMsg(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setMsg("Those passwords don't match.");
    setBusy(true);
    setMsg("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/app");
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <AuthCard title={mode === "invite" ? "Choose a password" : "Choose a new password"}>
      <form onSubmit={submit} className="stack-8" noValidate>
        <input
          className="input"
          type="password"
          placeholder={`password (min ${MIN_PASSWORD} characters)`}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="New password"
        />
        <input
          className="input"
          type="password"
          placeholder="confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-label="Confirm password"
        />
        <FormMessage>{msg}</FormMessage>
        <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy}>
          {busy ? "…" : mode === "invite" ? "Save and start playing" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}
