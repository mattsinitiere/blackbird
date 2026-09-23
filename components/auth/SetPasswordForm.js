"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import AuthCard, { NotConfigured, FormMessage } from "./AuthCard";

const MIN_PASSWORD = 6;
const CODE_LENGTH = 6;

/** True when the page was opened from an emailed link that carries a token. */
function urlHasToken() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return /access_token=|type=|error=/.test(hash) || /[?&](code|token_hash)=/.test(search);
}

/**
 * Choose a password after an invite (mode "invite") or a password reset
 * (mode "reset"). Two ways in, matching the emails Blackbird sends:
 *  - the link: Supabase consumes the token in the URL and opens a session
 *  - the code: the player types their email and the 6-digit code from the
 *    email, useful when the email was opened on a different device
 */
export default function SetPasswordForm({ mode = "reset" }) {
  const router = useRouter();
  const params = useSearchParams();
  const otpType = mode === "invite" ? "invite" : "recovery";
  const [phase, setPhase] = useState("waiting"); // waiting | code | ready | expired
  const [linkError, setLinkError] = useState("");
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    if (!urlHasToken()) {
      // opened by hand (or from the "enter your code" instruction): if a
      // session already exists the password form can show right away
      supabase.auth.getSession().then(({ data }) => setPhase(data.session ? "ready" : "code"));
      return;
    }
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

  const title = mode === "invite" ? "Welcome to Blackbird" : "Reset password";
  const backHref = mode === "invite" ? "/signup" : "/reset";
  const backLabel = mode === "invite" ? "Request a new invite" : "Request a new reset link";

  const verifyCode = async (e) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (!email.trim()) return setMsg("Enter the email the code was sent to.");
    if (token.length !== CODE_LENGTH) return setMsg(`Enter the ${CODE_LENGTH}-digit code from the email.`);
    setBusy(true);
    setMsg("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: otpType });
      if (error) throw error;
      if (!data.session) throw new Error("That code didn't open a session. Request a new email and try again.");
      setPhase("ready");
    } catch (err) {
      setMsg(err.message || "That code isn't right.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
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

  if (phase === "waiting") {
    return (
      <AuthCard title={title}>
        <p className="subtle" style={{ marginBottom: 0 }} role="status">
          Checking your link…
        </p>
      </AuthCard>
    );
  }

  if (phase === "code" || phase === "expired") {
    return (
      <AuthCard title={title} links={[{ href: backHref, label: backLabel }, { href: "/login", label: "Sign in" }]}>
        {phase === "expired" && (
          <FormMessage>
            That link is invalid or has expired{linkError ? ` (${linkError.replace(/\+/g, " ")})` : ""}. You can still use the code from the same email.
          </FormMessage>
        )}
        <p className="subtle" style={{ marginTop: phase === "expired" ? 10 : 0 }}>
          Enter your email and the {CODE_LENGTH}-digit code from the {mode === "invite" ? "invite" : "reset"} email.
        </p>
        <form onSubmit={verifyCode} className="stack-8" noValidate>
          <input className="input" type="email" placeholder="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <input
            className="input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={`${CODE_LENGTH}-digit code`}
            maxLength={CODE_LENGTH + 2}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            aria-label="Verification code"
            style={{ letterSpacing: "0.3em", fontVariantNumeric: "tabular-nums" }}
          />
          <FormMessage>{msg}</FormMessage>
          <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy}>
            {busy ? "…" : "Continue"}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={mode === "invite" ? "Choose a password" : "Choose a new password"}>
      <form onSubmit={savePassword} className="stack-8" noValidate>
        <input className="input" type="password" placeholder={`password (min ${MIN_PASSWORD} characters)`} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="New password" />
        <input className="input" type="password" placeholder="confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Confirm password" />
        <FormMessage>{msg}</FormMessage>
        <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy}>
          {busy ? "…" : mode === "invite" ? "Save and start playing" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}
