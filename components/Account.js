import { useState } from "react";
import { BackBar } from "./ui";
import { supabase } from "@/lib/supabase";

export default function Account({ user, players, addPlayer, signOut, back }) {
  const current = user?.user_metadata?.display_name || "";
  const [name, setName] = useState(current);
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: name.trim() },
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

  const trimmed = name.trim();
  const isPlayer = players.some(
    (p) => p.username.toLowerCase() === trimmed.toLowerCase()
  );

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
          onClick={save}
          disabled={busy || !trimmed || trimmed === current}
        >
          {busy ? "Saving…" : "Save display name"}
        </button>
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
