"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { safeNext } from "@/lib/authRedirect";
import AuthCard, { NotConfigured, FormMessage, Field, PasswordInput } from "./AuthCard";

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
      <form onSubmit={submit} className="stack" noValidate>
        <Field id="signin-email" label="Email">
          <input
            id="signin-email"
            className="input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="signin-password" label="Password">
          <PasswordInput
            id="signin-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <FormMessage>{msg}</FormMessage>
        <button className="btn btn-primary mt-12" style={{ width: "100%", padding: 14 }} type="submit" disabled={busy || (ready && !!session)}>
          {busy ? "…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
