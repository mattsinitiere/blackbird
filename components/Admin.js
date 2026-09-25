import { useEffect, useState, useCallback, useRef } from "react";
import { callAdmin } from "@/lib/adminClient";
import AdminAnalytics from "./AdminAnalytics";
import { BackBar, PlayerBadge, Modal } from "./ui";
import TagEditor from "./TagEditor";
import { PICKER_COLORS } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { defaultPlayerColor } from "@/lib/constants";
import { normalizeHandle, validateHandle, suggestHandle } from "@/lib/profile";
import { validateNewAccount } from "@/lib/adminAccount";

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}


function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function DropdownMenu({ items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} style={{
      position: "absolute", top: "100%", right: 0, marginTop: 4,
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: "var(--radius)", padding: "6px 0", minWidth: 180, zIndex: 10,
      boxShadow: "var(--shadow-lift)",
    }}>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          disabled={item.disabled}
          style={{
            display: "block", width: "100%", padding: "10px 16px",
            background: "none", border: "none", cursor: item.disabled ? "default" : "pointer",
            textAlign: "left", fontSize: "calc(14px * var(--fs))", fontFamily: "inherit",
            color: item.danger ? "var(--red)" : "var(--ink)",
            opacity: item.disabled ? 0.4 : 1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function Admin({ stats, addPlayer, back, refreshData, playerColors }) {
  const [tab, setTab] = useState("users");
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");
  const [adding, setAdding] = useState(false); // the Add New Player form
  const [tagging, setTagging] = useState(null); // { username, tag, tagIcon }
  const [openMenu, setOpenMenu] = useState(null);
  const [editing, setEditing] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameTo, setRenameTo] = useState("");
  const [handling, setHandling] = useState(null); // username whose @handle is being edited
  const [handleTo, setHandleTo] = useState("");
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

  useEffect(() => { load(); }, [load]);

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
    if (typeof window !== "undefined" && !window.confirm(`Delete the login account for ${email}? This removes their ability to sign in.`)) return;
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
    if (typeof window !== "undefined" && !window.confirm(`Remove "${username}" from the player list and delete all their game history?`)) return;
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

  const resetScore = async (username, games) => {
    const msg =
      `Reset ${username}'s score?\n\n` +
      `This deletes the ${games} game${games === 1 ? "" : "s"} on their record and sets their Elo back to 1000. ` +
      `Everyone else keeps their own records untouched. This can't be undone.`;
    if (typeof window !== "undefined" && !window.confirm(msg)) return;
    setBusy("p:" + username);
    setErr("");
    try {
      await callAdmin({ action: "resetScore", username });
      flash(`Reset ${username}'s score.`);
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const createAccount = async (form) => {
    setBusy("add");
    setErr("");
    try {
      const r = await callAdmin({ action: "createAccount", ...form });
      flash(`Created ${r.username}. They can sign in now.`);
      setAdding(false);
      await load();
      refreshData && refreshData();
      return null;
    } catch (e) {
      return e.message;
    } finally {
      setBusy("");
    }
  };

  const saveTag = async () => {
    if (!tagging) return;
    setBusy("tag");
    setErr("");
    try {
      await callAdmin({ action: "setTag", username: tagging.username, tag: tagging.tag || "", tagIcon: tagging.tagIcon || null });
      flash(`Updated ${tagging.username}'s tag.`);
      setTagging(null);
      await load();
      refreshData && refreshData();
    } catch (e) {
      setErr(e.message);
      setTagging(null);
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

  const renamePlayer = async (oldName) => {
    const trimmed = renameTo.trim();
    if (!trimmed || trimmed === oldName) { setRenaming(null); return; }
    setBusy("p:" + oldName);
    setErr("");
    try {
      await callAdmin({ action: "renamePlayer", oldName, newName: trimmed });
      flash(`Renamed "${oldName}" to "${trimmed}".`);
      setRenaming(null);
      setRenameTo("");
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const setHandle = async (username) => {
    const handle = normalizeHandle(handleTo);
    const check = validateHandle(handle);
    if (!check.ok) { setErr(check.reason); return; }
    setBusy("p:" + username);
    setErr("");
    try {
      await callAdmin({ action: "setHandle", username, handle });
      flash(`${username} is now @${handle}.`);
      setHandling(null);
      setHandleTo("");
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const linkPlayer = async (username, authId) => {
    setBusy("p:" + username);
    setErr("");
    try {
      await callAdmin({ action: "linkPlayer", username, authId });
      flash(authId ? `Linked ${username} to account.` : `Unlinked ${username}.`);
      await load();
      refreshData && refreshData();
    } catch (er) {
      setErr(er.message);
    } finally {
      setBusy("");
    }
  };

  const setEdit = (id, key, val) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const merged = [];
  if (data) {
    const userByName = {};
    for (const u of data.users) {
      const dn = (u.displayName || "").toLowerCase();
      if (dn) userByName[dn] = u;
    }
    const usedUserIds = new Set();

    for (const p of data.players) {
      let account = null;
      if (p.authId) {
        account = data.users.find((u) => u.id === p.authId) || null;
      }
      if (!account) {
        account = userByName[(p.username || "").toLowerCase()] || null;
      }
      if (account) usedUserIds.add(account.id);
      merged.push({ player: p, account });
    }

    for (const u of data.users) {
      if (!usedUserIds.has(u.id)) {
        merged.push({ player: null, account: u });
      }
    }
  }

  return (
    <div className="fade">
      <BackBar back={back} title="Admin Panel" />

      <div className="seg mb-12" role="tablist" aria-label="Admin sections">
        <button type="button" role="tab" aria-selected={tab === "users"} className="seg-btn" onClick={() => setTab("users")}>
          Users
        </button>
        <button type="button" role="tab" aria-selected={tab === "analytics"} className="seg-btn" onClick={() => setTab("analytics")}>
          Analytics
        </button>
      </div>

      {tab === "analytics" ? (
        <AdminAnalytics />
      ) : (
        <>

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
          <button type="button" className="btn btn-primary mb-12" style={{ width: "100%", padding: 14 }} onClick={() => setAdding(true)}>
            Add New Player
          </button>

          <div className="tag" style={{ marginBottom: 10 }}>
            People ({merged.length})
          </div>

          <div className="stack mb-12">
            {merged.length === 0 && (
              <div className="card">
                <p className="subtle" style={{ margin: 0 }}>No players or accounts yet.</p>
              </div>
            )}
            {merged.map((entry) => {
              const { player: p, account: acct } = entry;
              const username = p?.username || acct?.displayName || "?";
              const s = stats[username] || { games: 0, wins: 0, winPct: 0, x01: { threeDartAvg: 0 } };
              const key = p ? "p:" + p.username : "u:" + acct.id;
              const busyHere = busy === key || busy === "p:" + username || (acct && busy === acct.id);
              const isRenaming = renaming === username;
              const isHandling = handling === username;
              const handleCheck = isHandling ? validateHandle(normalizeHandle(handleTo)) : { ok: true };
              const isEditing = editing === username;
              const hasAccount = !!acct;
              const hasPlayer = !!p;
              const color = playerColors?.[username] || defaultPlayerColor(username);

              const menuItems = [];
              if (hasPlayer) {
                menuItems.push({ label: "Rename", action: () => { setHandling(null); setRenaming(username); setRenameTo(username); } });
                menuItems.push({ label: p.handle ? "Change handle" : "Set handle", action: () => { setRenaming(null); setHandling(username); setHandleTo(p.handle || ""); } });
                menuItems.push({ label: "Edit tag", action: () => setTagging({ username, tag: p.tag || "", tagIcon: p.tagIcon || null }) });
                menuItems.push({ label: p.hidden ? "Show on leaderboard" : "Hide from leaderboard", action: () => togglePlayerHidden(username, p.hidden) });
                menuItems.push({ label: "Reset score", danger: true, action: () => resetScore(username, s.games) });
                menuItems.push({ label: "Remove player", danger: true, action: () => removePlayer(username) });
              }
              if (hasAccount) {
                menuItems.push({ label: "Edit account", action: () => setEditing(isEditing ? null : username) });
                menuItems.push({ label: "Delete account", danger: true, action: () => deleteUser(acct.id, acct.email) });
              }
              if (hasPlayer && !hasAccount) {
                const matchable = data.users.filter((u) => !data.players.some((pp) => pp.authId === u.id));
                if (matchable.length > 0) {
                  menuItems.push({ label: "Link to account…", action: () => setEditing(username) });
                }
              }
              if (hasPlayer && hasAccount && p.authId) {
                menuItems.push({ label: "Unlink account", action: () => linkPlayer(username, null) });
              }

              return (
                <div className="card" key={key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    {isRenaming ? (
                      <div className="row" style={{ flex: 1, minWidth: 0 }}>
                        <input
                          className="input"
                          value={renameTo}
                          onChange={(e) => setRenameTo(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renamePlayer(username); if (e.key === "Escape") setRenaming(null); }}
                          placeholder="New name"
                          autoFocus
                          style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" style={{ flex: "none", minWidth: 64 }} disabled={busyHere || !renameTo.trim() || renameTo.trim() === username} onClick={() => renamePlayer(username)}>
                          {busyHere ? "…" : "Save"}
                        </button>
                        <button className="btn" style={{ flex: "none" }} onClick={() => setRenaming(null)}>Cancel</button>
                      </div>
                    ) : isHandling ? (
                      <div className="row" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                          <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 700 }}>@</span>
                          <input
                            className="input"
                            value={handleTo}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            style={{ paddingLeft: 30, borderColor: handleTo && !handleCheck.ok ? "var(--red)" : undefined }}
                            onChange={(e) => setHandleTo(normalizeHandle(e.target.value))}
                            onKeyDown={(e) => { if (e.key === "Enter" && handleCheck.ok) setHandle(username); if (e.key === "Escape") setHandling(null); }}
                            placeholder="handle"
                            aria-label={`Handle for ${username}`}
                            autoFocus
                          />
                        </div>
                        <button className="btn btn-primary" style={{ flex: "none", minWidth: 64 }} disabled={busyHere || !handleCheck.ok || handleTo === (p?.handle || "")} onClick={() => setHandle(username)}>
                          {busyHere ? "…" : "Save"}
                        </button>
                        <button className="btn" style={{ flex: "none" }} onClick={() => setHandling(null)}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <PlayerBadge username={username} color={color} size={32} showName={false} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "calc(16px * var(--fs))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {username}
                            {p?.handle && (
                              <span style={{ fontWeight: 700, fontSize: "calc(13px * var(--fs))", color: "var(--accent)", marginLeft: 8 }}>@{p.handle}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                            {hasAccount && (
                              <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "calc(10px * var(--fs-chrome))" }}>
                                logged in
                              </span>
                            )}
                            {!hasAccount && hasPlayer && (
                              <span className="tag" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "calc(10px * var(--fs-chrome))" }}>
                                no account
                              </span>
                            )}
                            {p?.hidden && (
                              <span className="tag" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "calc(10px * var(--fs-chrome))" }}>
                                hidden
                              </span>
                            )}
                            {!hasPlayer && hasAccount && (
                              <span className="tag" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "calc(10px * var(--fs-chrome))" }}>
                                account only
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ position: "relative", flex: "none" }}>
                          <button
                            className="btn"
                            style={{ padding: "6px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            onClick={() => setOpenMenu(openMenu === username ? null : username)}
                            aria-label="Actions"
                          >
                            <DotsIcon />
                          </button>
                          {openMenu === username && (
                            <DropdownMenu items={menuItems} onClose={() => setOpenMenu(null)} />
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {hasPlayer && (
                    <div className="grid-4" style={{ marginBottom: isEditing ? 12 : 0 }}>
                      <div className="mini">
                        <div className="num">{s.games}</div>
                        <div className="tag" style={{ marginTop: 2, fontSize: "calc(10px * var(--fs-chrome))" }}>games</div>
                      </div>
                      <div className="mini">
                        <div className="num">{s.wins}</div>
                        <div className="tag" style={{ marginTop: 2, fontSize: "calc(10px * var(--fs-chrome))" }}>wins</div>
                      </div>
                      <div className="mini">
                        <div className="num">{s.games ? Math.round(s.winPct) + "%" : "—"}</div>
                        <div className="tag" style={{ marginTop: 2, fontSize: "calc(10px * var(--fs-chrome))" }}>win rate</div>
                      </div>
                      <div className="mini">
                        <div className="num">{s.x01 && s.x01.threeDartAvg ? s.x01.threeDartAvg.toFixed(1) : "—"}</div>
                        <div className="tag" style={{ marginTop: 2, fontSize: "calc(10px * var(--fs-chrome))" }}>3-dart avg</div>
                      </div>
                    </div>
                  )}

                  {isEditing && hasAccount && (() => {
                    const e = edits[acct.id] || { email: "", password: "", displayName: "" };
                    return (
                      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: hasPlayer ? 0 : 0 }}>
                        <div style={{ marginBottom: 12 }}>
                          <div className="tag" style={{ marginBottom: 6 }}>Email</div>
                          <input
                            className="input"
                            value={e.email}
                            onChange={(ev) => setEdit(acct.id, "email", ev.target.value)}
                            placeholder="email"
                            autoCapitalize="none"
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <div className="tag" style={{ marginBottom: 6 }}>Reset password</div>
                          <input
                            className="input"
                            type="text"
                            value={e.password}
                            onChange={(ev) => setEdit(acct.id, "password", ev.target.value)}
                            placeholder="new password (leave blank to keep)"
                            autoCapitalize="none"
                          />
                        </div>
                        <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "0 0 12px" }}>
                          Joined {fmtDate(acct.createdAt)}
                        </p>
                        <div className="row">
                          <button
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            disabled={busyHere}
                            onClick={() => saveUser(acct.id)}
                          >
                            {busyHere ? "Saving…" : "Save"}
                          </button>
                          <button className="btn" style={{ flex: "none" }} onClick={() => setEditing(null)}>
                            Done
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {isEditing && !hasAccount && hasPlayer && (() => {
                    const unlinkedUsers = data.users.filter((u) => !data.players.some((pp) => pp.authId === u.id));
                    return (
                      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                        <div className="tag" style={{ marginBottom: 6 }}>Link to an account</div>
                        {unlinkedUsers.length === 0 ? (
                          <p className="subtle" style={{ margin: 0 }}>No unlinked accounts available.</p>
                        ) : (
                          <div className="row">
                            <select
                              className="select"
                              style={{ flex: 1 }}
                              defaultValue=""
                              onChange={(ev) => {
                                if (ev.target.value) linkPlayer(username, ev.target.value);
                                setEditing(null);
                              }}
                            >
                              <option value="">Select an account…</option>
                              {unlinkedUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName || u.email}
                                </option>
                              ))}
                            </select>
                            <button className="btn" style={{ flex: "none" }} onClick={() => setEditing(null)}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </>
      )}
      {adding && <AddPlayerForm busy={busy === "add"} onCancel={() => setAdding(false)} onCreate={createAccount} />}
      {tagging && (
        <Modal>
          <h2 className="admin-modal-title">Edit {tagging.username}&apos;s Tag</h2>
          <TagEditor username={tagging.username} color={playerColors?.[tagging.username]} tag={tagging.tag} tagIcon={tagging.tagIcon} onChange={({ tag, tagIcon }) => setTagging((t) => ({ ...t, tag, tagIcon }))} idPrefix="admin-tag" />
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setTagging(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={saveTag} disabled={busy === "tag"}>
              {busy === "tag" ? "Saving…" : "Save Tag"}
            </button>
          </div>
        </Modal>
      )}
        </>
      )}
    </div>
  );
}

/**
 * Add New Player: a full account (email + password sign-in, confirmed) and
 * its player row, created together by /api/admin createAccount.
 */
function AddPlayerForm({ busy, onCancel, onCreate }) {
  const [f, setF] = useState({ displayName: "", email: "", handle: "", password: "", color: "", tag: "", tagIcon: null });
  const [handleEdited, setHandleEdited] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const submit = async (e) => {
    e.preventDefault();
    const v = validateNewAccount(f);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setError("");
    const problem = await onCreate(v.value);
    if (problem) setError(problem);
  };
  return (
    <Modal>
      <form onSubmit={submit} className="admin-form">
        <h2 className="admin-modal-title">Add New Player</h2>
        <label>
          <span>Display name</span>
          <input className="input" value={f.displayName} autoComplete="off" onChange={(e) => set({ displayName: e.target.value, ...(handleEdited ? {} : { handle: e.target.value.trim() ? suggestHandle(e.target.value) : "" }) })} />
        </label>
        <label>
          <span>Email</span>
          <input className="input" type="email" inputMode="email" autoComplete="off" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </label>
        <label>
          <span>@handle</span>
          <input
            className="input"
            value={f.handle}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => {
              setHandleEdited(true);
              set({ handle: normalizeHandle(e.target.value) });
            }}
          />
        </label>
        <label>
          <span>Password</span>
          <div className="row">
            <input className="input" type={show ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} style={{ flex: 1 }} />
            <button type="button" className="btn" style={{ flex: "none" }} onClick={() => setShow((s) => !s)}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <div>
          <span className="admin-form-label">Colour (optional)</span>
          <div className="admin-swatches">
            {PICKER_COLORS.map((c) => (
              <button key={c} type="button" className={`admin-swatch${f.color === c ? " is-on" : ""}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => set({ color: f.color === c ? "" : c })} />
            ))}
          </div>
        </div>
        <TagEditor username={f.displayName.trim() || "New player"} color={f.color || undefined} tag={f.tag} tagIcon={f.tagIcon} onChange={({ tag, tagIcon }) => set({ tag, tagIcon })} idPrefix="new-tag" />
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <div className="row" style={{ marginTop: 6 }}>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
            {busy ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
