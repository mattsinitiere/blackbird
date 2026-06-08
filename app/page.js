"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { getPlayers, addPlayer as dbAddPlayer, getMatches, addMatch } from "@/lib/db";
import { computeElo, computeStats } from "@/lib/stats";
import { Board } from "@/components/ui";
import Auth from "@/components/Auth";
import Home from "@/components/Home";
import Setup from "@/components/Setup";
import PlayX01 from "@/components/PlayX01";
import PlayCricket from "@/components/PlayCricket";
import Leaderboard from "@/components/Leaderboard";
import Profile from "@/components/Profile";
import Matchup from "@/components/Matchup";
import Insights from "@/components/Insights";

export default function Page() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);

  const [dataReady, setDataReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("home");
  const [live, setLive] = useState(null);
  const [profileUser, setProfileUser] = useState(null);

  // ---- auth ----
  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- data loading ----
  const refresh = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([getPlayers(), getMatches()]);
      setPlayers(p);
      setMatches(m);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Failed to load data.");
    } finally {
      setDataReady(true);
    }
  }, []);

  useEffect(() => {
    if (session) {
      setDataReady(false);
      refresh();
    }
  }, [session, refresh]);

  // pull latest when the app regains focus (e.g. you switch back on your phone)
  useEffect(() => {
    if (!session) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [session, refresh]);

  const usernames = useMemo(() => players.map((p) => p.username), [players]);
  const stats = useMemo(() => computeStats(matches), [matches]);
  const elo = useMemo(() => computeElo(matches, usernames), [matches, usernames]);

  const addPlayer = useCallback(async (name) => {
    const u = name.trim();
    if (!u) return false;
    if (players.some((p) => p.username.toLowerCase() === u.toLowerCase())) return false;
    const ok = await dbAddPlayer(u);
    if (ok) await refresh();
    return ok;
  }, [players, refresh]);

  const finishMatch = useCallback(async (match) => {
    await addMatch(match);
    await refresh();
    setLive(null);
    setView("leaderboard");
  }, [refresh]);

  const openProfile = (u) => {
    setProfileUser(u);
    setView("profile");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setView("home");
  };

  // ---- gates ----
  if (!isConfigured) {
    return (
      <main className="app">
        <div className="container" style={{ maxWidth: 460, paddingTop: 80 }}>
          <div className="card">
            <h2 className="section-title">Setup needed</h2>
            <p className="subtle">
              Supabase isn&apos;t configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code> (local) or in
              your Vercel project settings, then rebuild. See the README.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authReady) return <LoadingScreen text="starting up…" />;
  if (!session) return <Auth />;
  if (!dataReady) return <LoadingScreen text="loading the oche…" />;

  return (
    <main className="app">
      <div className="container">
        <header className="header">
          <Board size={36} />
          <div style={{ flex: 1 }}>
            <div className="brand-title">Blackbird</div>
            <div className="tag" style={{ marginTop: 2 }}>
              dart scoring system
            </div>
          </div>
          <button className="btn" style={{ padding: "8px 11px" }} onClick={refresh} title="Refresh">
            ↻
          </button>
          <button className="btn" style={{ padding: "8px 11px" }} onClick={signOut}>
            Sign out
          </button>
        </header>

        {loadError && (
          <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
            <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>{loadError}</p>
          </div>
        )}

        {view === "home" && (
          <Home setView={setView} stats={stats} elo={elo} players={players} matches={matches} openProfile={openProfile} />
        )}
        {view === "setup" && (
          <Setup
            players={players}
            addPlayer={addPlayer}
            onStart={(game) => {
              setLive(game);
              setView(game.gameType === "x01" ? "playX01" : "playCricket");
            }}
            back={() => setView("home")}
          />
        )}
        {view === "playX01" && live && (
          <PlayX01 game={live} onFinish={finishMatch} onQuit={() => { setLive(null); setView("home"); }} />
        )}
        {view === "playCricket" && live && (
          <PlayCricket game={live} onFinish={finishMatch} onQuit={() => { setLive(null); setView("home"); }} />
        )}
        {view === "leaderboard" && (
          <Leaderboard usernames={usernames} stats={stats} elo={elo} openProfile={openProfile} back={() => setView("home")} />
        )}
        {view === "profile" && profileUser && (
          <Profile user={profileUser} stats={stats[profileUser]} elo={elo[profileUser]} matches={matches} back={() => setView("leaderboard")} />
        )}
        {view === "matchup" && (
          <Matchup usernames={usernames} elo={elo} matches={matches} stats={stats} back={() => setView("home")} />
        )}
        {view === "insights" && (
          <Insights usernames={usernames} stats={stats} elo={elo} matches={matches} back={() => setView("home")} />
        )}

        <nav className="nav">
          <button className={`navbtn ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>Home</button>
          <button className={`navbtn ${["setup", "playX01", "playCricket"].includes(view) ? "active" : ""}`} onClick={() => setView("setup")}>Play</button>
          <button className={`navbtn ${["leaderboard", "profile"].includes(view) ? "active" : ""}`} onClick={() => setView("leaderboard")}>Stats</button>
          <button className={`navbtn ${view === "matchup" ? "active" : ""}`} onClick={() => setView("matchup")}>Matchup</button>
          <button className={`navbtn ${view === "insights" ? "active" : ""}`} onClick={() => setView("insights")}>AI</button>
        </nav>
      </div>
    </main>
  );
}

function LoadingScreen({ text }) {
  return (
    <main className="app">
      <div className="container" style={{ textAlign: "center", paddingTop: 90 }}>
        <div className="num" style={{ fontSize: 26, color: "var(--muted)" }}>{text}</div>
      </div>
    </main>
  );
}
