"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useMyPlayer, PLAYER_UPDATED_EVENT } from "@/lib/useMyPlayer";
import { updatePlayerProfile, setPlayerColor, isHandleAvailable } from "@/lib/db";
import { normalizeHandle, validateHandle, suggestHandle, BIO_MAX, LOCATION_MAX } from "@/lib/profile";
import { PLAYER_COLORS, defaultPlayerColor } from "@/lib/constants";
import { PlayerBadge } from "@/components/ui";

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_UPDATED_EVENT));
}

function memberSince(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * The signed-in player's profile on the public site: the same fields the
 * app's Account screen edits (display name, handle, bio, location, player
 * colour), shown in the website frame. Signed-out visitors go to /login.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { ready, session } = useSession();
  const { loading, player, color, reload } = useMyPlayer(session);

  useEffect(() => {
    if (isConfigured && ready && !session) router.replace("/login?next=%2Fprofile");
  }, [ready, session, router]);

  if (!isConfigured) {
    return (
      <main className="mk-wrap mk-main-frame mk-profile-page" id="main">
        <h1>Your profile</h1>
        <p className="mk-profile-note">Accounts are not set up on this deployment yet.</p>
      </main>
    );
  }
  if (!ready || !session || loading) {
    return (
      <main className="mk-wrap mk-main-frame mk-profile-page" id="main" aria-busy="true">
        <h1>Your profile</h1>
        <p className="mk-profile-note">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mk-wrap mk-main-frame mk-profile-page" id="main">
      <Link className="mk-legal-back" href="/">
        Back to Blackbird
      </Link>
      <h1>Your profile</h1>
      {player ? (
        <ProfileForm key={player.username} user={session.user} player={player} color={color} onSaved={reload} />
      ) : (
        <div className="card">
          <p className="subtle" style={{ marginTop: 0 }}>
            Your player profile is created the first time you open the app.
          </p>
          <Link className="btn btn-primary" href="/app">
            Open Blackbird
          </Link>
        </div>
      )}
    </main>
  );
}

function ProfileForm({ user, player, color, onSaved }) {
  const meta = user?.user_metadata || {};
  const [name, setName] = useState(meta.display_name || player.username);
  const [handle, setHandle] = useState(player.handle || suggestHandle(player.username));
  const [bio, setBio] = useState(player.bio || "");
  const [location, setLocation] = useState(player.location || "");
  const [avail, setAvail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [good, setGood] = useState(false);
  const [colorBusy, setColorBusy] = useState(false);
  const [custom, setCustom] = useState(PLAYER_COLORS.includes(color) ? "" : color);

  const check = validateHandle(handle);
  useEffect(() => {
    if (!check.ok || handle === player.handle) {
      setAvail(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const ok = await isHandleAvailable(handle, player.username);
      if (live) setAvail(ok);
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [handle, check.ok, player.handle, player.username]);

  const trimmedName = name.trim();
  const nameChanged = trimmedName && trimmedName !== (meta.display_name || "");
  const profileChanged = handle !== (player.handle || "") || bio.trim() !== (player.bio || "") || location.trim() !== (player.location || "");
  const handleProblem = !check.ok ? check.reason : avail === false ? "That handle is taken." : "";
  const canSave = !busy && !handleProblem && avail !== false && (nameChanged || profileChanged);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (nameChanged) {
        const { error } = await supabase.auth.updateUser({ data: { ...meta, display_name: trimmedName } });
        if (error) throw error;
      }
      if (profileChanged) {
        const r = await updatePlayerProfile(player.username, { handle, bio: bio.trim(), location: location.trim() });
        if (!r.ok) throw new Error(r.reason || "Couldn't save.");
      }
      setGood(true);
      setMsg("Profile saved.");
      announce();
      onSaved && onSaved();
    } catch (e) {
      setGood(false);
      setMsg(e.message || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const pickColor = async (hex) => {
    setColorBusy(true);
    setMsg("");
    try {
      await setPlayerColor(player.username, hex);
      setCustom(PLAYER_COLORS.includes(hex) ? "" : hex);
      announce();
      onSaved && onSaved();
    } catch (e) {
      setGood(false);
      setMsg(e.message || "Couldn't save the colour.");
    } finally {
      setColorBusy(false);
    }
  };

  const current = color || defaultPlayerColor(player.username);

  return (
    <div className="mk-profile-grid">
      <section className="card mk-profile-card" aria-label="Profile summary">
        <div className="mk-profile-hero">
          <PlayerBadge username={player.username} color={current} size={72} showName={false} />
          <div style={{ minWidth: 0 }}>
            <div className="display mk-profile-name">{meta.display_name || player.username}</div>
            <div className="mk-profile-handle">{player.handle ? `@${player.handle}` : "no handle yet"}</div>
            {player.location && <div className="subtle" style={{ margin: "4px 0 0" }}>{player.location}</div>}
          </div>
        </div>
        {player.bio && <p className="mk-profile-bio">{player.bio}</p>}
        <dl className="mk-profile-facts">
          <div>
            <dt>Elo</dt>
            <dd>{Math.round(player.elo)}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{memberSince(player.createdAt) || "—"}</dd>
          </div>
          <div>
            <dt>Standings</dt>
            <dd>{player.hidden ? "Hidden" : "Visible"}</dd>
          </div>
        </dl>
        <Link className="btn" href="/app" style={{ width: "100%", marginTop: 14 }}>
          Open Blackbird
        </Link>
      </section>

      <section className="card mk-profile-card" aria-label="Edit profile">
        <div className="tag" style={{ marginBottom: 10 }}>Edit</div>

        <label className="tag" htmlFor="pf-name" style={{ display: "block", marginBottom: 6 }}>Display name</label>
        <input id="pf-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />

        <label className="tag" htmlFor="pf-handle" style={{ display: "block", margin: "14px 0 6px" }}>Handle</label>
        <div style={{ position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontWeight: 700 }}>@</span>
          <input
            id="pf-handle"
            className="input"
            value={handle}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ paddingLeft: 30, borderColor: handleProblem ? "var(--red)" : avail === true ? "var(--accent)" : undefined }}
            onChange={(e) => setHandle(normalizeHandle(e.target.value))}
          />
        </div>
        <p className="tag" style={{ margin: "6px 0 0", textTransform: "none", letterSpacing: 0, color: handleProblem ? "var(--red)" : avail === true ? "var(--accent)" : undefined }}>
          {handleProblem || (avail === true ? "Available." : "3–20 characters: letters, numbers, underscores. Friends find you by it.")}
        </p>

        <label className="tag" htmlFor="pf-bio" style={{ display: "block", margin: "14px 0 6px" }}>Bio</label>
        <textarea id="pf-bio" className="input" rows={2} maxLength={BIO_MAX} value={bio} placeholder="Double-out enthusiast. Tuesday league at the Longhorn." onChange={(e) => setBio(e.target.value)} style={{ resize: "vertical", fontFamily: "inherit" }} />
        <div className="tag" style={{ textAlign: "right", marginTop: 4 }}>{bio.length}/{BIO_MAX}</div>

        <label className="tag" htmlFor="pf-location" style={{ display: "block", margin: "10px 0 6px" }}>Location</label>
        <input id="pf-location" className="input" maxLength={LOCATION_MAX} value={location} placeholder="Home bar or town" onChange={(e) => setLocation(e.target.value)} />

        <div className="tag" style={{ margin: "16px 0 8px" }}>Player colour</div>
        <div className="mk-profile-colors" role="group" aria-label="Player colour">
          {PLAYER_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`mk-profile-swatch${current === hex ? " is-on" : ""}`}
              style={{ background: hex }}
              onClick={() => pickColor(hex)}
              disabled={colorBusy}
              aria-label={`Colour ${hex}`}
              aria-pressed={current === hex}
            />
          ))}
          <label className={`mk-profile-swatch mk-profile-swatch-custom${custom ? " is-on" : ""}`} style={{ background: custom || "transparent" }} title="Custom colour">
            <input type="color" value={current} onChange={(e) => pickColor(e.target.value)} disabled={colorBusy} aria-label="Custom colour" />
            {!custom && <span aria-hidden="true">+</span>}
          </label>
        </div>

        {msg && (
          <p className="subtle" role="status" style={{ marginBottom: 0, color: good ? "var(--accent)" : "var(--red)" }}>
            {msg}
          </p>
        )}
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={save} disabled={!canSave}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </section>
    </div>
  );
}
