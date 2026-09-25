import { useState, useEffect, useRef } from "react";
import { BackBar, PlayerBadge, Modal, TagPill } from "./ui";
import { supabase } from "@/lib/supabase";
import { isHandleAvailable } from "@/lib/db";
import { FONT_SCALES, PICKER_COLORS, defaultPlayerColor } from "@/lib/constants";
import { COVERS, coverId } from "@/lib/covers";
import TagEditor from "./TagEditor";
import ProfileCover from "./profile/ProfileCover";
import { applyFontScale } from "@/lib/prefs";
import { setFeedbackPrefs, feedback } from "@/lib/feedback";
import { normalizeHandle, validateHandle, suggestHandle, validateTag, BIO_MAX, LOCATION_MAX } from "@/lib/profile";

/** An on/off switch (role="switch"), used for the accessibility options. */
function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " is-on" : ""}`} onClick={() => onChange(!on)}>
      <span className="switch-knob" />
    </button>
  );
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "accessibility", label: "Accessibility" },
  { id: "account", label: "Account" },
];

/**
 * Settings, in three sections: Profile (who you are and how you look),
 * Appearance (theme and text size) and Account (friends, data, sign out).
 *
 * Text edits (display name, @handle, bio, location, name tag) are held as
 * one set of unsaved changes: a bar docks just above the bottom nav with
 * Discard and Save Changes whenever anything differs from what is saved.
 * One-tap choices (colour, cover, theme, text size, leaderboard) save
 * straight away, as before.
 */
export default function Account({ user, players, results, addPlayer, setPlayerHidden, setPlayerColor, updatePlayerProfile, myPlayer: myPlayerProp, playerColors, isAdmin, onOpenAdmin, social, onOpenFriends, signOut, back, focus = null }) {
  const meta = user?.user_metadata || {};
  const savedName = meta.display_name || "";
  const [section, setSection] = useState("profile");
  const [theme, setTheme] = useState(meta.theme === "dark" ? "dark" : "light");
  const [fontScale, setFontScale] = useState(FONT_SCALES.some((f) => f.id === meta.fontScale) ? meta.fontScale : "normal");
  const [haptics, setHaptics] = useState(meta.haptics !== false);
  const [sounds, setSounds] = useState(meta.sounds === true);
  const setFeedback = (patch) => {
    if (patch.haptics !== undefined) setHaptics(patch.haptics);
    if (patch.sounds !== undefined) setSounds(patch.sounds);
    setFeedbackPrefs(patch);
    persist(patch);
    // a sample so you feel / hear what you just switched on
    if (patch.haptics || patch.sounds) feedback("dart");
  };

  const myPlayer = myPlayerProp || players.find((p) => p.username.toLowerCase() === savedName.trim().toLowerCase()) || null;
  const saved = {
    name: savedName,
    handle: myPlayer?.handle || "",
    bio: myPlayer?.bio || "",
    location: myPlayer?.location || "",
    tag: myPlayer?.tag || "",
    tagIcon: myPlayer?.tagIcon || null,
  };
  const [draft, setDraft] = useState(saved);
  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNote(null);
  };

  const [avail, setAvail] = useState(null); // null unknown | true | false
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null); // { ok, text }
  const [askLeave, setAskLeave] = useState(false);
  const timer = useRef(null);
  const topRef = useRef(null);

  const changed = (k) => (draft[k] || null) !== (saved[k] || null);
  const dirty = ["name", "handle", "bio", "location", "tag", "tagIcon"].some(changed);
  const handleCheck = changed("handle") ? validateHandle(draft.handle) : { ok: true };
  const tagCheck = validateTag(draft.tag);
  const problem = !draft.name.trim()
    ? "Your display name can't be empty."
    : !handleCheck.ok
    ? handleCheck.reason
    : avail === false
    ? "That handle is taken."
    : !tagCheck.ok
    ? tagCheck.reason
    : "";

  // the player row can arrive after this screen opens (first sign-in)
  useEffect(() => {
    setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlayer?.id]);

  // live @handle availability (debounced)
  useEffect(() => {
    if (!changed("handle") || !handleCheck.ok || !myPlayer) {
      setAvail(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => setAvail(await isHandleAvailable(draft.handle, myPlayer.username)), 350);
    return () => timer.current && clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.handle]);

  // "Edit profile" on the profile page lands on the Profile section
  useEffect(() => {
    if (focus === "profile") {
      setSection("profile");
      topRef.current?.scrollIntoView({ block: "start" });
    }
  }, [focus]);

  const persist = async (patch) => {
    try {
      await supabase.auth.updateUser({ data: { ...(user.user_metadata || {}), ...patch } });
    } catch (e) {
      // preference still applied locally
    }
  };

  const save = async () => {
    if (!dirty || problem) return;
    setBusy(true);
    setNote(null);
    try {
      if (changed("name")) {
        const { error } = await supabase.auth.updateUser({ data: { ...(user.user_metadata || {}), display_name: draft.name.trim() } });
        if (error) throw error;
      }
      const fields = ["handle", "bio", "location", "tag", "tagIcon"].filter(changed);
      if (fields.length && myPlayer && updatePlayerProfile) {
        const patch = {};
        for (const k of fields) patch[k] = k === "bio" || k === "location" ? draft[k].trim() : draft[k] || null;
        const r = await updatePlayerProfile(myPlayer.username, patch);
        if (!r.ok) throw new Error(r.reason || "Couldn't save.");
      }
      setNote({ ok: true, text: "Saved" });
    } catch (e) {
      setNote({ ok: false, text: e.message || "Couldn't save." });
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    setDraft(saved);
    setAvail(null);
    setNote(null);
  };
  const goBack = () => (dirty ? setAskLeave(true) : back());

  const applyTheme = (t) => {
    setTheme(t);
    if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
    persist({ theme: t });
  };
  const applyTextSize = (id) => {
    setFontScale(id);
    applyFontScale(id);
    persist({ fontScale: id });
  };

  const [hideBusy, setHideBusy] = useState(false);
  const toggleLeaderboard = async () => {
    if (!myPlayer) return;
    setHideBusy(true);
    try {
      await setPlayerHidden(myPlayer.username, !myPlayer.hidden);
    } finally {
      setHideBusy(false);
    }
  };
  const [coverBusy, setCoverBusy] = useState(null);
  const chooseCover = async (id) => {
    if (!myPlayer || !updatePlayerProfile) return;
    setCoverBusy(id);
    const r = await updatePlayerProfile(myPlayer.username, { cover: id === "playon" ? null : id });
    setCoverBusy(null);
    if (!r.ok) setNote({ ok: false, text: r.reason });
  };

  const exportData = (format) => {
    const me = savedName.trim().toLowerCase();
    const myResults = results.filter((r) => r.username.toLowerCase() === me);
    const rows = myResults.length > 0 ? myResults : results;
    let blob;
    let filename;
    if (format === "json") {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      filename = "blackbird-results.json";
    } else {
      const cols = ["gameId", "gameType", "username", "result", "opponents", "completedAt"];
      const lines = [cols.join(",")];
      for (const r of rows) {
        lines.push(
          cols
            .map((c) => {
              const v = r[c];
              if (Array.isArray(v)) return `"${v.join(";")}"`;
              if (typeof v === "string" && v.includes(",")) return `"${v}"`;
              return v == null ? "" : v;
            })
            .join(",")
        );
      }
      blob = new Blob([lines.join("\n")], { type: "text/csv" });
      filename = "blackbird-results.csv";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addMe = async () => {
    const ok = await addPlayer(savedName.trim());
    setNote({ ok, text: ok ? `Added "${savedName.trim()}" to the player list.` : "That name is already a player." });
  };

  const myColor = myPlayer ? playerColors?.[myPlayer.username] || defaultPlayerColor(myPlayer.username) : null;
  const customColor = myColor && !PICKER_COLORS.includes(myColor);
  const currentCover = coverId(myPlayer?.cover);

  return (
    <div className="fade" ref={topRef} style={{ scrollMarginTop: 16 }}>
      <BackBar back={goBack} title="Settings" />

      <div className="seg mb-12" role="tablist" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={section === s.id} className="seg-btn" onClick={() => setSection(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {section === "profile" && (
        <>
          <div className="card mb-12">
            <div className="set-preview">
              <PlayerBadge username={myPlayer?.username || draft.name || "?"} color={myColor || undefined} size={44} showName={false} />
              <div style={{ minWidth: 0 }}>
                <div className="set-preview-name">
                  <span>{myPlayer?.username || draft.name}</span>
                  <TagPill tag={draft.tag || null} tagIcon={draft.tagIcon || null} />
                </div>
                <div className="set-preview-handle">{draft.handle ? `@${draft.handle}` : "no handle yet"}</div>
              </div>
            </div>

            <label className="set-label" htmlFor="set-name">Display Name</label>
            <input id="set-name" className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name" />

            {myPlayer && (
              <>
                <label className="set-label" htmlFor="set-handle">Handle</label>
                <div style={{ position: "relative" }}>
                  <span aria-hidden="true" className="set-at">@</span>
                  <input
                    id="set-handle"
                    className="input"
                    value={draft.handle}
                    placeholder={suggestHandle(myPlayer.username)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ paddingLeft: 30, borderColor: changed("handle") && (!handleCheck.ok || avail === false) ? "var(--red)" : avail === true ? "var(--accent)" : undefined }}
                    onChange={(e) => set({ handle: normalizeHandle(e.target.value) })}
                  />
                </div>
                <p className="set-hint" style={{ color: changed("handle") && (!handleCheck.ok || avail === false) ? "var(--red)" : undefined }}>
                  {changed("handle") && !handleCheck.ok
                    ? handleCheck.reason
                    : avail === false
                    ? "That handle is taken."
                    : avail === true
                    ? "Available."
                    : "3–20 characters: letters, numbers, underscores. Friends find you by it."}
                </p>

                <label className="set-label" htmlFor="set-bio">Bio</label>
                <textarea
                  id="set-bio"
                  className="input"
                  rows={2}
                  maxLength={BIO_MAX}
                  value={draft.bio}
                  placeholder="Double-out enthusiast. Tuesday league at the Longhorn."
                  onChange={(e) => set({ bio: e.target.value })}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
                <div className="set-count">{draft.bio.length}/{BIO_MAX}</div>

                <label className="set-label" htmlFor="set-location">Location</label>
                <input id="set-location" className="input" maxLength={LOCATION_MAX} value={draft.location} placeholder="Home bar or town" onChange={(e) => set({ location: e.target.value })} />

                <TagEditor username={myPlayer.username} color={myColor} tag={draft.tag} tagIcon={draft.tagIcon} onChange={({ tag, tagIcon }) => set({ tag, tagIcon })} isDev={!!isAdmin} />
              </>
            )}
          </div>

          {!myPlayer && savedName.trim() && (
              <div className="card mb-12">
                <p className="subtle" style={{ marginTop: 0 }}>
                  Add yourself to the shared player list so you can be picked in games and tracked in the standings.
                </p>
                <button className="btn" style={{ width: "100%" }} onClick={addMe}>
                  Add &quot;{savedName.trim()}&quot; as a player
                </button>
              </div>
          )}
        </>
      )}

      {section === "appearance" && (
        <>
          {myPlayer && (
            <>
              <div className="card mb-12">
                <div className="set-title">Player Color</div>
                <p className="set-hint" style={{ marginTop: 2 }}>Shows next to your name everywhere. Saves as soon as you tap.</p>
                <div className="swatches" role="radiogroup" aria-label="Player color">
                  {PICKER_COLORS.map((hex, i) => (
                    <button
                      key={hex}
                      type="button"
                      role="radio"
                      aria-checked={myColor === hex}
                      aria-label={i === 0 ? "Blackbird navy" : hex}
                      title={i === 0 ? "Blackbird navy" : hex}
                      className={`swatch${myColor === hex ? " is-on" : ""}`}
                      style={{ background: hex }}
                      onClick={() => setPlayerColor(myPlayer.username, hex)}
                    />
                  ))}
                  <label className={`swatch swatch-custom${customColor ? " is-on" : ""}`} title="Custom color" style={customColor ? { background: myColor } : undefined}>
                    <input type="color" aria-label="Custom color" value={myColor} onChange={(e) => setPlayerColor(myPlayer.username, e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="card mb-12">
                <div className="set-title">Profile Cover</div>
                <p className="set-hint" style={{ marginTop: 2 }}>The banner across the top of your profile.</p>
                <div className="cover-grid" role="radiogroup" aria-label="Profile cover">
                  {COVERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={currentCover === c.id}
                      className={`cover-opt${currentCover === c.id ? " is-on" : ""}`}
                      onClick={() => chooseCover(c.id)}
                      disabled={!!coverBusy}
                    >
                      <ProfileCover cover={c.id} mini />
                      <span>{coverBusy === c.id ? "Saving…" : c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

            </>
          )}
        <div className="card mb-12">
          <div className="set-title">Theme</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className={`btn ${theme === "light" ? "btn-toggle-on" : ""}`} style={{ flex: 1 }} onClick={() => applyTheme("light")}>
              Light
            </button>
            <button className={`btn ${theme === "dark" ? "btn-toggle-on" : ""}`} style={{ flex: 1 }} onClick={() => applyTheme("dark")}>
              Dark
            </button>
          </div>

        </div>
        </>
      )}

      {section === "accessibility" && (
        <>
          <div className="card mb-12">
          <div className="set-title">Text Size</div>
          <div className="grid-4" style={{ marginTop: 8 }}>
            {FONT_SCALES.map((f) => (
              <button key={f.id} className={`btn ${fontScale === f.id ? "btn-toggle-on" : ""}`} onClick={() => applyTextSize(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="card pad-sm mt-12" style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}>
            <span className="num" style={{ fontSize: "calc(34px * var(--fs))", color: "var(--accent)" }}>180</span>
            <span className="subtle">preview — how scores will look</span>
          </div>
          </div>

          <div className="card mb-12">
            <div className="set-toggle">
              <div>
                <div className="set-title">Haptics</div>
                <div className="set-hint" style={{ marginTop: 2 }}>A tap on each dart, a double pulse on a bust, a longer one on a checkout or win. Android only: iPhone browsers can't vibrate yet.</div>
              </div>
              <Switch on={haptics} label="Haptics" onChange={(v) => setFeedback({ haptics: v })} />
            </div>
            <div className="set-toggle" style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div>
                <div className="set-title">Sounds</div>
                <div className="set-hint" style={{ marginTop: 2 }}>A soft tick per dart, a low note on a bust, a chime on a checkout or win.</div>
              </div>
              <Switch on={sounds} label="Sounds" onChange={(v) => setFeedback({ sounds: v })} />
            </div>
          </div>
        </>
      )}

      {section === "account" && (
        <>
          <div className="card mb-12">
            <div className="set-title">Signed In As</div>
            <div style={{ fontWeight: 600, marginTop: 4, overflowWrap: "anywhere" }}>{user?.email}</div>
          </div>

          {myPlayer && (
              <div className="card mb-12 between" style={{ gap: 12 }}>
                <div>
                  <div className="set-title">Show on Leaderboard</div>
                  <div className="set-hint" style={{ marginTop: 2 }}>{myPlayer.hidden ? "You're hidden from the standings." : "You're visible in the standings."}</div>
                </div>
                <button className={`btn ${myPlayer.hidden ? "" : "btn-toggle-on"}`} style={{ minWidth: 92 }} onClick={toggleLeaderboard} disabled={hideBusy}>
                  {hideBusy ? "…" : myPlayer.hidden ? "Show me" : "Hide me"}
                </button>
              </div>
          )}

          {onOpenFriends && (
            <div className="card mb-12 between" style={{ gap: 12 }}>
              <div>
                <div className="set-title">Friends</div>
                <div className="set-hint" style={{ marginTop: 2 }}>
                  Following {social?.following?.length || 0} · Followers {social?.followers?.length || 0}. You see the games of the people you follow.
                </div>
              </div>
              <button className="btn btn-sm" onClick={onOpenFriends}>Manage</button>
            </div>
          )}

          {myPlayer && (
            <div className="card mb-12">
              <div className="set-title">Export Data</div>
              <p className="set-hint" style={{ marginTop: 2 }}>Download your game results as CSV or JSON.</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => exportData("csv")}>Export CSV</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => exportData("json")}>Export JSON</button>
              </div>
            </div>
          )}

          {isAdmin && (
            <button className="btn mb-12" style={{ width: "100%" }} onClick={onOpenAdmin}>
              Open Admin Panel
            </button>
          )}

          <button className="btn btn-danger" style={{ width: "100%" }} onClick={signOut}>
            Sign Out
          </button>
        </>
      )}

      {note && !dirty && (
        <p className={`set-note${note.ok ? " is-ok" : ""}`} role="status">
          {note.ok && (
            <svg className="set-note-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
          {note.text}
        </p>
      )}

      {dirty && (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <div className="save-bar-inner">
            <div className="save-bar-text">
              <strong>Unsaved changes</strong>
              {(problem || (note && !note.ok)) && <span className="save-bar-error">{problem || note.text}</span>}
            </div>
            <div className="save-bar-actions">
              <button type="button" className="btn btn-sm" onClick={discard} disabled={busy}>Discard</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={save} disabled={busy || !!problem}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {askLeave && (
        <Modal>
          <h3 className="section-title" style={{ fontSize: "calc(18px * var(--fs))" }}>Discard changes?</h3>
          <p className="subtle" style={{ marginTop: 0 }}>Your edits to your profile haven&apos;t been saved.</p>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setAskLeave(false)} autoFocus>
              Keep Editing
            </button>
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => {
                setAskLeave(false);
                discard();
                back();
              }}
            >
              Discard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
