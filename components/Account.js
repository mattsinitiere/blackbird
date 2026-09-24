import { useState, useEffect, useRef } from "react";
import { BackBar, PlayerBadge } from "./ui";
import { supabase } from "@/lib/supabase";
import { isHandleAvailable } from "@/lib/db";
import { FONT_SCALES, PLAYER_COLORS, defaultPlayerColor } from "@/lib/constants";
import TagEditor from "./TagEditor";
import { applyFontScale } from "@/lib/prefs";
import { normalizeHandle, validateHandle, suggestHandle, validateTag, BIO_MAX, LOCATION_MAX } from "@/lib/profile";

/**
 * @handle, bio and location editor for the signed-in account's own player
 * row. Availability is checked live (debounced) against the players table.
 */
function ProfileEditor({ player, updatePlayerProfile, playerColors }) {
  const [handle, setHandle] = useState(player.handle || suggestHandle(player.username));
  const [bio, setBio] = useState(player.bio || "");
  const [location, setLocation] = useState(player.location || "");
  const [tag, setTag] = useState(player.tag || "");
  const [tagIcon, setTagIcon] = useState(player.tagIcon || null);
  const [avail, setAvail] = useState(null); // null unknown | true | false
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const check = validateHandle(handle);
  const tagCheck = validateTag(tag);
  const unchanged =
    handle === (player.handle || "") && bio === (player.bio || "") && location === (player.location || "") && tag === (player.tag || "") && (tagIcon || null) === (player.tagIcon || null);

  useEffect(() => {
    if (!check.ok || handle === player.handle) {
      setAvail(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const ok = await isHandleAvailable(handle, player.username);
      setAvail(ok);
    }, 350);
    return () => timer.current && clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    const r = await updatePlayerProfile(player.username, { handle, bio: bio.trim(), location: location.trim(), tag: tag || null, tagIcon: tagIcon || null });
    setGood(r.ok);
    setMsg(r.ok ? "Profile saved." : r.reason);
    setBusy(false);
  };

  const handleProblem = !check.ok ? check.reason : avail === false ? "That handle is taken." : "";
  const canSave = !busy && !unchanged && check.ok && tagCheck.ok && avail !== false;

  return (
    <div className="card mb-12">
      <div className="tag" style={{ marginBottom: 10 }}>Profile</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <PlayerBadge username={player.username} color={playerColors?.[player.username]} size={44} showName={false} tag={null} tagIcon={null} />
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: "calc(18px * var(--fs))" }}>{player.username}</div>
          <div className="tag" style={{ textTransform: "none", letterSpacing: 0, color: "var(--accent)" }}>
            {handle ? `@${handle}` : "no handle yet"}
          </div>
        </div>
      </div>

      <div className="tag" style={{ marginBottom: 6 }}>Handle</div>
      <div style={{ position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 700 }}>@</span>
        <input
          className="input"
          value={handle}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{ paddingLeft: 30, borderColor: handleProblem ? "var(--red)" : avail === true ? "var(--accent)" : undefined }}
          onChange={(e) => setHandle(normalizeHandle(e.target.value))}
          aria-label="Handle"
        />
      </div>
      <p className="tag" style={{ margin: "6px 0 0", textTransform: "none", letterSpacing: 0, color: handleProblem ? "var(--red)" : avail === true ? "var(--accent)" : undefined }}>
        {handleProblem || (avail === true ? "Available." : "3–20 characters: letters, numbers, underscores. Friends find you by it.")}
      </p>

      <div className="tag" style={{ margin: "14px 0 6px" }}>Bio</div>
      <textarea
        className="input"
        rows={2}
        maxLength={BIO_MAX}
        value={bio}
        placeholder="Double-out enthusiast. Tuesday league at the Longhorn."
        onChange={(e) => setBio(e.target.value)}
        style={{ resize: "vertical", fontFamily: "inherit" }}
      />
      <div className="tag" style={{ textAlign: "right", marginTop: 4 }}>{bio.length}/{BIO_MAX}</div>

      <div className="tag" style={{ margin: "10px 0 6px" }}>Location</div>
      <input
        className="input"
        maxLength={LOCATION_MAX}
        value={location}
        placeholder="Home bar or town"
        onChange={(e) => setLocation(e.target.value)}
      />

      <TagEditor
        username={player.username}
        color={playerColors?.[player.username]}
        tag={tag}
        tagIcon={tagIcon}
        onChange={({ tag: t, tagIcon: i }) => {
          setTag(t);
          setTagIcon(i);
        }}
      />

      {msg && (
        <p className="subtle" style={{ marginBottom: 0, color: good ? "var(--accent)" : "var(--red)" }}>{msg}</p>
      )}
      <button className="btn btn-primary mt-12" style={{ width: "100%" }} onClick={save} disabled={!canSave}>
        {busy ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}

export default function Account({ user, players, results, addPlayer, setPlayerHidden, setPlayerColor, updatePlayerProfile, myPlayer: myPlayerProp, playerColors, isAdmin, onOpenAdmin, social, onOpenFriends, signOut, back, focus = null }) {
  const meta = user?.user_metadata || {};
  const [name, setName] = useState(meta.display_name || "");
  const [theme, setTheme] = useState(meta.theme === "dark" ? "dark" : "light");
  const [fontScale, setFontScale] = useState(
    FONT_SCALES.some((f) => f.id === meta.fontScale) ? meta.fontScale : "normal"
  );
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const applyTextSize = (id) => {
    setFontScale(id);
    applyFontScale(id);
    persist({ fontScale: id });
  };

  const trimmed = name.trim();
  const myPlayer = myPlayerProp || players.find((p) => p.username.toLowerCase() === trimmed.toLowerCase());
  const isPlayer = !!myPlayer;
  const [hideBusy, setHideBusy] = useState(false);
  // "Edit profile" on the profile page lands on the editor, not the top
  const editorRef = useRef(null);
  useEffect(() => {
    if (focus === "profile" && editorRef.current) editorRef.current.scrollIntoView({ block: "start" });
  }, [focus]);

  const toggleLeaderboard = async () => {
    if (!myPlayer) return;
    setHideBusy(true);
    try {
      await setPlayerHidden(myPlayer.username, !myPlayer.hidden);
    } finally {
      setHideBusy(false);
    }
  };

  const exportData = (format) => {
    const me = trimmed.toLowerCase();
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
        lines.push(cols.map((c) => {
          const v = r[c];
          if (Array.isArray(v)) return `"${v.join(";")}"`;
          if (typeof v === "string" && v.includes(",")) return `"${v}"`;
          return v == null ? "" : v;
        }).join(","));
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
    const ok = await addPlayer(trimmed);
    setGood(ok);
    setMsg(ok ? `Added "${trimmed}" to the player list.` : "That name is already a player.");
  };

  return (
    <div className="fade">
      <BackBar back={back} title="Account" />

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 6 }}>
          Signed In As
        </div>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>{user?.email}</div>

        <div className="tag" style={{ marginBottom: 6 }}>
          Display Name
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
          {busy ? "Saving…" : "Save Display Name"}
        </button>
      </div>

      {myPlayer && updatePlayerProfile && (
        <div ref={editorRef} style={{ scrollMarginTop: 16 }}>
          <ProfileEditor key={myPlayer.username} player={myPlayer} updatePlayerProfile={updatePlayerProfile} playerColors={playerColors} />
        </div>
      )}

      {onOpenFriends && (
        <div className="card mb-12">
          <div className="between">
            <div>
              <div className="tag" style={{ marginBottom: 4 }}>Friends</div>
              <div style={{ fontWeight: 700 }}>
                Following {social?.following?.length || 0} · Followers {social?.followers?.length || 0}
              </div>
              <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
                You see the games of the people you follow.
              </div>
            </div>
            <button className="btn btn-sm" onClick={onOpenFriends}>Manage</button>
          </div>
        </div>
      )}

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

        <div className="tag" style={{ margin: "14px 0 6px" }}>
          Text Size
        </div>
        <div className="grid-4">
          {FONT_SCALES.map((f) => (
            <button
              key={f.id}
              className={`btn ${fontScale === f.id ? "btn-toggle-on" : ""}`}
              onClick={() => applyTextSize(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div
          className="card pad-sm mt-12"
          style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}
        >
          <span className="num" style={{ fontSize: "calc(34px * var(--fs))", color: "var(--accent)" }}>
            180
          </span>
          <span className="subtle">preview — how scores will look</span>
        </div>

      </div>

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 10 }}>
          Player Profile
        </div>
        {!trimmed ? (
          <p className="subtle" style={{ margin: 0 }}>Set a display name above first.</p>
        ) : isPlayer ? (
          <>
            <p className="subtle" style={{ marginTop: 0, marginBottom: 14 }}>
              You&apos;re in the player list as <strong>{trimmed}</strong> — your stats show up under
              that name.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingTop: 14,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Show on Leaderboard</div>
                <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
                  {myPlayer.hidden ? "You're hidden from the standings." : "You're visible in the standings."}
                </div>
              </div>
              <button
                className={`btn ${myPlayer.hidden ? "" : "btn-toggle-on"}`}
                style={{ minWidth: 92 }}
                onClick={toggleLeaderboard}
                disabled={hideBusy}
              >
                {hideBusy ? "…" : myPlayer.hidden ? "Show me" : "Hide me"}
              </button>
            </div>

            <div style={{ paddingTop: 14, borderTop: "1px solid var(--line)", marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Player Color</div>
              <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginBottom: 8 }}>
                This color shows next to your name across all views.
              </div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <PlayerBadge username={myPlayer.username} color={playerColors?.[myPlayer.username]} size={32} />
              </div>
              <div className="flex-wrap" style={{ alignItems: "center" }}>
                {PLAYER_COLORS.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setPlayerColor(myPlayer.username, hex)}
                    aria-label={hex}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-sm)",
                      background: hex,
                      cursor: "pointer",
                      border: (playerColors?.[myPlayer.username] || defaultPlayerColor(myPlayer.username)) === hex
                        ? "3px solid var(--ink)"
                        : "2px solid var(--line)",
                    }}
                  />
                ))}
                <label
                  title="Custom color"
                  style={{
                    position: "relative",
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    overflow: "hidden",
                    border: playerColors?.[myPlayer.username] && !PLAYER_COLORS.includes(playerColors[myPlayer.username])
                      ? "3px solid var(--ink)"
                      : "2px solid var(--line)",
                    background: playerColors?.[myPlayer.username] && !PLAYER_COLORS.includes(playerColors[myPlayer.username])
                      ? playerColors[myPlayer.username]
                      : "conic-gradient(#e03a3a,#ea962b,#0e8c5a,#2563eb,#7c3aed,#e03a3a)",
                  }}
                >
                  <input
                    type="color"
                    value={playerColors?.[myPlayer.username] || defaultPlayerColor(myPlayer.username)}
                    onChange={(e) => setPlayerColor(myPlayer.username, e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                  />
                </label>
              </div>
            </div>
          </>
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

      {results && results.length > 0 && (
        <div className="card mb-12">
          <div className="tag" style={{ marginBottom: 10 }}>Export Data</div>
          <p className="subtle" style={{ marginTop: 0 }}>
            Download your game results as CSV or JSON.
          </p>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => exportData("csv")}>
              Export CSV
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => exportData("json")}>
              Export JSON
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <button
          className="btn mb-12"
          style={{ width: "100%" }}
          onClick={onOpenAdmin}
        >
          Open Admin Panel
        </button>
      )}

      <button className="btn btn-danger" style={{ width: "100%" }} onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}
