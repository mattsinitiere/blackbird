import { useState } from "react";
import { BackBar } from "./ui";
import { supabase } from "@/lib/supabase";
import { ACCENTS } from "@/lib/constants";

export default function Account({ user, players, addPlayer, signOut, back }) {
  const meta = user?.user_metadata || {};
  const [name, setName] = useState(meta.display_name || "");
  const [theme, setTheme] = useState(meta.theme === "dark" ? "dark" : "light");
  const [accent, setAccent] = useState(
    meta.accent && (meta.accent.charAt(0) === "#" || ACCENTS[meta.accent]) ? meta.accent : "green"
  );
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);

  const hexFor = (a) => (a.charAt(0) === "#" ? a : ACCENTS[a] || ACCENTS.green);
  const isCustom = accent.charAt(0) === "#";

  const persist = async (patch) => {
    try {
      await supabase.auth.updateUser({ data: { ...(user.user_metadata || {}), ...patch } });
    } catch (e) {
      // preference still applied locally
    }
  };

  const saveName = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: { ...(user.user_metadata || {}), display_name: name.trim() },
      });
      if (error) throw error;
      setGood(true);
      setMsg("Display name saved.");
    } catch (e) {
      setGood(false);
      setMsg(e.message || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const applyTheme = (t) => {
    setTheme(t);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
    persist({ theme: t });
  };

  const applyAccent = (value) => {
    setAccent(value);
    if (typeof document !== "undefined")
      document.documentElement.style.setProperty("--accent", hexFor(value));
    persist({ accent: value });
  };

  const trimmed = name.trim();
  const isPlayer = players.some((p) => p.username.toLowerCase() === trimmed.toLowerCase());

  const addMe = async () => {
    const ok = await addPlayer(trimmed);
    setGood(ok);
    setMsg(ok ? `Added "${trimmed}" to the player list.` : "That name is already a player.");
  };

  return (
    <div className="fade">
      <BackBar back={back} title="Account" />

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 6 }}>
          Signed in as
        </div>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>{user?.email}</div>

        <div className="tag" style={{ marginBottom: 6 }}>
          Display name
        </div>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
        />
        {msg && (
          <p className="subtle" style={{ marginBottom: 0, color: good ? "var(--accent)" : "var(--red)" }}>
            {msg}
          </p>
        )}
        <button
          className="btn btn-primary mt-12"
          style={{ width: "100%" }}
          onClick={saveName}
          disabled={busy || !trimmed || trimmed === (meta.display_name || "")}
        >
          {busy ? "Saving…" : "Save display name"}
        </button>
      </div>

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 10 }}>
          Appearance
        </div>

        <div className="tag" style={{ marginBottom: 6 }}>
          Theme
        </div>
        <div className="row">
          <button
            className={`btn ${theme === "light" ? "btn-toggle-on" : ""}`}
            style={{ flex: 1 }}
            onClick={() => applyTheme("light")}
          >
            Light
          </button>
          <button
            className={`btn ${theme === "dark" ? "btn-toggle-on" : ""}`}
            style={{ flex: 1 }}
            onClick={() => applyTheme("dark")}
          >
            Dark
          </button>
        </div>

        <div className="tag" style={{ margin: "14px 0 8px" }}>
          Accent color
        </div>
        <div className="flex-wrap" style={{ alignItems: "center" }}>
          {Object.entries(ACCENTS).map(([key, hex]) => (
            <button
              key={key}
              onClick={() => applyAccent(key)}
              aria-label={key}
              title={key}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: hex,
                cursor: "pointer",
                border: accent === key ? "3px solid var(--ink)" : "2px solid var(--line)",
              }}
            />
          ))}
          <label
            title="Custom color"
            style={{
              position: "relative",
              width: 36,
              height: 36,
              borderRadius: 10,
              cursor: "pointer",
              overflow: "hidden",
              border: isCustom ? "3px solid var(--ink)" : "2px solid var(--line)",
              background: isCustom
                ? accent
                : "conic-gradient(#e03a3a,#ea962b,#0e8c5a,#2563eb,#7c3aed,#e03a3a)",
            }}
          >
            <input
              type="color"
              value={isCustom ? accent : "#0e8c5a"}
              onChange={(e) => applyAccent(e.target.value)}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
            />
          </label>
        </div>
        <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
          Tap the rainbow swatch for a custom color.
        </p>
      </div>

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 10 }}>
          Player profile
        </div>
        {!trimmed ? (
          <p className="subtle" style={{ margin: 0 }}>Set a display name above first.</p>
        ) : isPlayer ? (
          <p className="subtle" style={{ margin: 0 }}>
            You&apos;re in the player list as <strong>{trimmed}</strong> — your stats show up under
            that name.
          </p>
        ) : (
          <>
            <p className="subtle" style={{ marginTop: 0 }}>
              Add yourself to the shared player list so you can be picked in games and tracked in
              the standings.
            </p>
            <button className="btn" style={{ width: "100%" }} onClick={addMe}>
              Add &quot;{trimmed}&quot; as a player
            </button>
          </>
        )}
      </div>

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
