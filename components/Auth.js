import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Board } from "./ui";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setMsg("Enter an email and password.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange in the app handles the redirect into the app.
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
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
          <Board size={40} />
          <div>
            <div className="brand-title">Blackbird</div>
            <div className="tag" style={{ marginTop: 2 }}>
              dart scoring system
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
          Private to your group. Everyone who signs in shares the same players and stats.
        </p>
      </div>
    </main>
  );
}
