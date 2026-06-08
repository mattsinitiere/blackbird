import { useEffect, useState, useCallback } from "react";
import { BackBar } from "./ui";
import { supabase } from "@/lib/supabase";

async function callAdmin(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed.");
  return json;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function Admin({ stats, back, refreshData }) {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const j = await callAdmin({ action: "list" });
      setData(j);
      const e = {};
      (j.users || []).forEach((u) => {
        e[u.id] = { email: u.email, password: "", displayName: u.displayName };
      });
      setEdits(e);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m) => {
    setOk(m);
    setErr("");
    setTimeout(() => setOk(""), 2500);
  };

  const saveUser = async (id) => {
    const e = edits[id];
    if (!e) return;
    setBusy(id);
    setErr("");
    try {
      await callAdmin({
        action: "updateUser",
        userId: id,
        email: e.email,
        password: e.password || undefined,
        displayName: e.displayName,
      });
      flash("Account updated.");
      await load();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const deleteUser = async (id, email) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete the account ${email}? This removes their login permanently.`)) return;
    setBusy(id);
    setErr("");
    try {
      await callAdmin({ action: "deleteUser", userId: id });
      flash("Account deleted.");
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const removePlayer = async (username) => {
    if (typeof window !== "undefined" && !window.confirm(`Remove "${username}" from the player list? Their past games stay recorded, but they leave the roster and standings.`)) return;
    setBusy("p:" + username);
    setErr("");
    try {
      await callAdmin({ action: "deletePlayer", username });
      flash(`Removed ${username}.`);
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const togglePlayerHidden = async (username, hidden) => {
    setBusy("p:" + username);
    setErr("");
    try {
      await callAdmin({ action: "setHidden", username, hidden: !hidden });
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const setEdit = (id, key, val) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  return (
    <div className="fade">
      <BackBar back={back} title="Admin panel" />

      {err && (
        <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
          <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>{err}</p>
        </div>
      )}
      {ok && (
        <div className="card mb-12" style={{ borderColor: "var(--accent)" }}>
          <p className="subtle" style={{ margin: 0, color: "var(--accent)" }}>{ok}</p>
        </div>
      )}

      {!data ? (
        <div className="card">
          <p className="subtle" style={{ margin: 0 }}>Loading…</p>
        </div>
      ) : (
        <>
          {/* ---------- Players + stats ---------- */}
          <div className="tag" style={{ marginBottom: 10 }}>
            Players &amp; stats ({data.players.length})
          </div>
          <div className="stack mb-12">
            {data.players.length === 0 && (
              <div className="card">
                <p className="subtle" style={{ margin: 0 }}>No players yet.</p>
              </div>
            )}
            {data.players.map((p) => {
              const s = stats[p.username] || { games: 0, wins: 0, winPct: 0, x01: { threeDartAvg: 0 } };
              const busyHere = busy === "p:" + p.username;
              return (
                <div className="card" key={p.username}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.username}
                    </div>
                    {p.hidden && (
                      <span
                        className="tag"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "3px 8px", borderRadius: 999 }}
                      >
                        hidden
                      </span>
                    )}
                  </div>
                  <div className="grid-4" style={{ marginBottom: 12 }}>
                    <div className="mini">
                      <div className="num">{s.games}</div>
                      <div className="tag" style={{ marginTop: 2, fontSize: 10 }}>games</div>
                    </div>
                    <div className="mini">
                      <div className="num">{s.wins}</div>
                      <div className="tag" style={{ marginTop: 2, fontSize: 10 }}>wins</div>
                    </div>
                    <div className="mini">
                      <div className="num">{s.games ? Math.round(s.winPct) + "%" : "—"}</div>
                      <div className="tag" style={{ marginTop: 2, fontSize: 10 }}>win rate</div>
                    </div>
                    <div className="mini">
                      <div className="num">{s.x01 && s.x01.threeDartAvg ? s.x01.threeDartAvg.toFixed(1) : "—"}</div>
                      <div className="tag" style={{ marginTop: 2, fontSize: 10 }}>3-dart avg</div>
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="btn"
                      style={{ flex: 1 }}
                      disabled={busyHere}
                      onClick={() => togglePlayerHidden(p.username, p.hidden)}
                    >
                      {busyHere ? "…" : p.hidden ? "Show on leaderboard" : "Hide from leaderboard"}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 1 }}
                      disabled={busyHere}
                      onClick={() => removePlayer(p.username)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ---------- Accounts ---------- */}
          <div className="tag" style={{ margin: "18px 0 10px" }}>
            Login accounts ({data.users.length})
          </div>
          <p className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 0, marginBottom: 12 }}>
            Changing a display name updates the account only. Stats already recorded stay under the
            old name.
          </p>
          <div className="stack">
            {data.users.map((u) => {
              const e = edits[u.id] || { email: "", password: "", displayName: "" };
              const busyHere = busy === u.id;
              return (
                <div className="card" key={u.id}>
                  <div style={{ marginBottom: 16 }}>
                    <div className="tag" style={{ marginBottom: 7 }}>Display name</div>
                    <input
                      className="input"
                      value={e.displayName}
                      onChange={(ev) => setEdit(u.id, "displayName", ev.target.value)}
                      placeholder="display name"
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div className="tag" style={{ marginBottom: 7 }}>Email</div>
                    <input
                      className="input"
                      value={e.email}
                      onChange={(ev) => setEdit(u.id, "email", ev.target.value)}
                      placeholder="email"
                      autoCapitalize="none"
                    />
                  </div>

                  <div style={{ paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                    <div className="tag" style={{ marginBottom: 7 }}>Reset password</div>
                    <input
                      className="input"
                      type="text"
                      value={e.password}
                      onChange={(ev) => setEdit(u.id, "password", ev.target.value)}
                      placeholder="new password"
                      autoCapitalize="none"
                    />
                    <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "8px 0 0" }}>
                      Leave blank to keep their current password.
                    </p>
                  </div>

                  <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "16px 0 0" }}>
                    Joined {fmtDate(u.createdAt)}
                  </p>
                  <div className="row" style={{ marginTop: 16 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      disabled={busyHere}
                      onClick={() => saveUser(u.id)}
                    >
                      {busyHere ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ flex: 1 }}
                      disabled={busyHere}
                      onClick={() => deleteUser(u.id, u.email)}
                    >
                      Delete account
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
