import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Logo } from "./ui";
import { normalizeHandle, suggestHandle, validateHandle } from "@/lib/profile";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const handleCheck = mode === "signup" && handle ? validateHandle(handle) : { ok: true };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setMsg("Enter an email and password.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setMsg("Enter a display name.");
      return;
    }
    if (mode === "signup" && handle && !handleCheck.ok) {
      setMsg(handleCheck.reason);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim(), handle: handle || suggestHandle(displayName) } },
        });
        if (error) throw error;
        if (!data.session) {
          setMsg("Account created — check your email to confirm, then sign in.");
          setMode("signin");
        }
      }
    } catch (e) {
      setMsg(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app">
      <div className="container" style={{ maxWidth: 380, paddingTop: 70 }}>
        <div className="header" style={{ justifyContent: "center" }}>
          <Logo size={40} />
          <div>
            <div className="brand-title">Blackbird</div>
            <div className="tag" style={{ marginTop: 2 }}>
              Dart Scoring System
            </div>
          </div>
        </div>

        <div className="card fade">
          <div className="row mb-12">
            <button
              className={`btn ${mode === "signin" ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              className={`btn ${mode === "signup" ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setMode("signup")}
            >
              Create account
            </button>
          </div>

          <div className="stack-8">
            {mode === "signup" && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="display name"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (!handleTouched) setHandle(suggestHandle(e.target.value));
                  }}
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
              </>
            )}
            <input
              className="input"
              type="email"
              placeholder="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="password (min 6 characters)"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          {msg && (
            <p className="subtle" style={{ color: "var(--red)", marginBottom: 0 }}>
              {msg}
            </p>
          )}

          <button
            className="btn btn-primary mt-12"
            style={{ width: "100%", padding: 14 }}
            onClick={submit}
            disabled={busy}
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>

        <p className="tag" style={{ marginTop: 16, textAlign: "center", textTransform: "none", letterSpacing: 0 }}>
          © 2026 Sinitiere Technology
        </p>
      </div>
    </main>
  );
}
