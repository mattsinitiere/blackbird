"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { safeNext } from "@/lib/authRedirect";
import AuthCard, { NotConfigured, FormMessage } from "./AuthCard";

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { ready, session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // already signed in: skip the form
  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, next, router]);

  if (!isConfigured) return <NotConfigured />;

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMsg("Enter an email and password.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(next);
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Sign in"
      links={[
        { href: "/reset", label: "Forgot password?" },
        { href: "/signup", label: "Have an invite? Create account" },
      ]}
    >
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
        <input
          className="input"
          type="password"
          placeholder="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="Password"
        />
        <FormMessage>{msg}</FormMessage>
        <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy || (ready && !!session)}>
          {busy ? "…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
