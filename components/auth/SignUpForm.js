"use client";

import { useState } from "react";
import { isConfigured } from "@/lib/supabase";
import { normalizeHandle, suggestHandle, validateHandle } from "@/lib/profile";
import AuthCard, { NotConfigured, FormMessage } from "./AuthCard";

/**
 * Invite-only account creation. The server checks the invite code and sends
 * a Supabase invite email; the link in that email lands on /signup/accept
 * where the new player chooses a password.
 */
export default function SignUpForm() {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const handleCheck = handle ? validateHandle(handle) : { ok: true };

  if (!isConfigured) return <NotConfigured />;

  if (sent) {
    return (
      <AuthCard title="Check your email" links={[{ href: "/login", label: "Back to sign in" }]}>
        <p className="subtle" style={{ marginBottom: 0 }}>
          Your invite is on its way to <strong>{email}</strong>. Open the link in that email to choose a password and start playing.
        </p>
      </AuthCard>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return setMsg("Enter your invite code.");
    if (!displayName.trim()) return setMsg("Enter a display name.");
    if (handle && !handleCheck.ok) return setMsg(handleCheck.reason);
    if (!email.trim()) return setMsg("Enter your email.");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          email: email.trim(),
          displayName: displayName.trim(),
          handle: handle || suggestHandle(displayName),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSent(true);
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create account" links={[{ href: "/login", label: "Already have an account? Sign in" }]}>
      <p className="subtle" style={{ marginTop: 0 }}>
        Blackbird is invite-only right now. Enter the code you were given and we&apos;ll email you a link to finish setting up.
      </p>
      <form onSubmit={submit} className="stack-8" noValidate>
        <input
          className="input"
          type="text"
          placeholder="invite code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Invite code"
        />
        <input
          className="input"
          type="text"
          placeholder="display name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (!handleTouched) setHandle(suggestHandle(e.target.value));
          }}
          aria-label="Display name"
        />
        <div style={{ position: "relative" }}>
          <span
            aria-hidden="true"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 700 }}
          >
            @
          </span>
          <input
            className="input"
            type="text"
            placeholder="handle"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ paddingLeft: 30, borderColor: handle && !handleCheck.ok ? "var(--red)" : undefined }}
            value={handle}
            onChange={(e) => {
              setHandleTouched(true);
              setHandle(normalizeHandle(e.target.value));
            }}
            aria-label="Handle"
          />
        </div>
        <p className="tag" style={{ margin: 0, textTransform: "none", letterSpacing: 0, color: handle && !handleCheck.ok ? "var(--red)" : undefined }}>
          {handle && !handleCheck.ok ? handleCheck.reason : "Your @handle is how friends find you. Letters, numbers, underscores."}
        </p>
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
          {busy ? "…" : "Send my invite"}
        </button>
      </form>
    </AuthCard>
  );
}
