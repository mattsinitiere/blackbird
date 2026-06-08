"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isConfigured } from "@/lib/supabase";
import { getPlayers, addPlayer as dbAddPlayer, getMatches, addMatch } from "@/lib/db";
import { computeElo, computeStats } from "@/lib/stats";
import { Logo } from "@/components/ui";
import Auth from "@/components/Auth";
import Home from "@/components/Home";
import Setup from "@/components/Setup";
import PlayX01 from "@/components/PlayX01";
import PlayCricket from "@/components/PlayCricket";
import PlayBaseball from "@/components/PlayBaseball";
import Leaderboard from "@/components/Leaderboard";
import Profile from "@/components/Profile";
import Matchup from "@/components/Matchup";
import Insights from "@/components/Insights";
import Account from "@/components/Account";

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
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

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
    if (match.players.length >= 2) {
      await addMatch(match);
      await refresh();
      setLive(null);
      setNotice("");
      setView("leaderboard");
    } else {
      // solo practice — not saved
      setLive(null);
      setNotice("Practice game finished — not saved to stats.");
      setView("home");
    }
  }, [refresh]);

  const openProfile = (u) => {
    setProfileUser(u);
    setView("profile");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setView("home");
  };

  const quit = () => {
    setLive(null);
    setView("home");
  };

  if (!isConfigured) {
    return (
      <main className="app">
        <div className="container" style={{ maxWidth: 460, paddingTop: 80 }}>
          <div className="card">
            <h2 className="section-title">Setup needed</h2>
            <p className="subtle">
              Supabase isn&apos;t configured. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, then rebuild.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!authReady) return <LoadingScreen text="starting up…" />;
  if (!session) return <Auth />;
  if (!dataReady) return <LoadingScreen text="loading…" />;

  return (
    <main className="app">
      <div className="container">
        <header className="header">
          <Logo size={36} />
          <div style={{ flex: 1 }}>
            <div className="brand-title">Blackbird</div>
            <div className="tag" style={{ marginTop: 2 }}>
              dart scoring system
            </div>
          </div>
          <button className="btn" style={{ padding: "8px 11px" }} onClick={refresh} title="Refresh">
            ↻
          </button>
          <button
            className="btn"
            style={{ padding: "8px 11px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onClick={() => setView("account")}
            title="Account"
          >
            {session.user?.user_metadata?.display_name || "Account"}
          </button>
        </header>

        {loadError && (
          <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
            <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>{loadError}</p>
          </div>
        )}
        {notice && view === "home" && (
          <div className="card mb-12" style={{ borderColor: "var(--amber)" }}>
            <p className="subtle" style={{ margin: 0, color: "var(--amber)" }}>{notice}</p>
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
              setView(
                game.gameType === "x01" ? "playX01" : game.gameType === "cricket" ? "playCricket" : "playBaseball"
              );
            }}
            back={() => setView("home")}
          />
        )}
        {view === "playX01" && live && <PlayX01 game={live} onFinish={finishMatch} onQuit={quit} />}
        {view === "playCricket" && live && <PlayCricket game={live} onFinish={finishMatch} onQuit={quit} />}
        {view === "playBaseball" && live && <PlayBaseball game={live} onFinish={finishMatch} onQuit={quit} />}
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
        {view === "account" && (
          <Account user={session.user} players={players} addPlayer={addPlayer} signOut={signOut} back={() => setView("home")} />
        )}

        <nav className="nav">
          <button className={`navbtn ${view === "home" ? "active" : ""}`} onClick={() => setView("home")}>Home</button>
          <button className={`navbtn ${["setup", "playX01", "playCricket", "playBaseball"].includes(view) ? "active" : ""}`} onClick={() => setView("setup")}>Play</button>
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
