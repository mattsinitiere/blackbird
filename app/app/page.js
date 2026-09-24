"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { getPlayers, addPlayer as dbAddPlayer, linkPlayerAuth as dbLinkPlayerAuth, setPlayerHidden as dbSetPlayerHidden, setPlayerColor as dbSetPlayerColor, updatePlayerProfile as dbUpdatePlayerProfile, getGameResults, recordGame, getFollows, followPlayer as dbFollowPlayer, unfollowPlayer as dbUnfollowPlayer } from "@/lib/db";
import { followingUsernames, followerUsernames, circlePlayers as circleOf, followsForSocial } from "@/lib/follows";
import { normalizeHandle, validateHandle } from "@/lib/profile";
import { computeStats, eloMapFromPlayers, applyEloUpdate } from "@/lib/stats";
import { ADMIN_EMAIL, defaultPlayerColor } from "@/lib/constants";
import { applyFontScale } from "@/lib/prefs";
import { makeCastCode, openCastChannel, castAvailable, stripHistory } from "@/lib/cast";
import { buildSummary } from "@/lib/summary";
import { isRankedMatch, splitResults, botLadder } from "@/lib/practice";
import { botColors } from "@/lib/bots";
import { rematchGame } from "@/lib/games";
import { Logo, GearIcon, CastIcon, PlayerBadge, Modal, pressProps, PlayerLookContext } from "@/components/ui";
import Home from "@/components/Home";
import Setup from "@/components/Setup";
import PlayX01 from "@/components/PlayX01";
import PlayCricket from "@/components/PlayCricket";
import PlayBaseball from "@/components/PlayBaseball";
import PlayAroundTheClock from "@/components/PlayAroundTheClock";
import PlayKiller from "@/components/PlayKiller";
import PlayShanghai from "@/components/PlayShanghai";
import PlayHalveIt from "@/components/PlayHalveIt";
import PlayGotcha from "@/components/PlayGotcha";
import PlayTicTacToe from "@/components/PlayTicTacToe";
import PlayBobs27 from "@/components/PlayBobs27";
import PlayCheckoutDrill from "@/components/PlayCheckoutDrill";
import PlayScoringDrill from "@/components/PlayScoringDrill";
import Leaderboard from "@/components/Leaderboard";
import Profile from "@/components/Profile";
import Matchup from "@/components/Matchup";

import Records from "@/components/Records";
import Practice from "@/components/Practice";
import Account from "@/components/Account";
import Admin from "@/components/Admin";
import LoadingScreen from "@/components/LoadingScreen";
import GameSummary from "@/components/GameSummary";
import BlackbirdAI from "@/components/BlackbirdAI";
import Friends from "@/components/Friends";

const PLAY_VIEWS = { x01: "playX01", cricket: "playCricket", baseball: "playBaseball", aroundTheClock: "playAroundTheClock", killer: "playKiller", shanghai: "playShanghai", halveit: "playHalveIt", gotcha: "playGotcha", tictactoe: "playTicTacToe", bobs27: "playBobs27", checkoutDrill: "playCheckoutDrill", scoringDrill: "playScoringDrill" };

export default function Page() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);

  // Branded splash: hold the loading screen 1–3 s on every open so the app
  // always launches with a moment of perceived loading.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1000 + Math.random() * 2000);
    return () => clearTimeout(t);
  }, []);

  const [dataReady, setDataReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [allResults, setAllResults] = useState([]);
  // follows rows visible to me; null until loaded, or when the follows
  // table is not installed yet (then everyone is in my circle)
  const [follows, setFollows] = useState(null);
  // competitive rows drive stats/Elo/standings; practice rows feed the practice log
  const { competitive: results, practice } = useMemo(() => splitResults(allResults), [allResults]);
  const [loadError, setLoadError] = useState("");

  const [view, setView] = useState("home");
  const [live, setLive] = useState(null);
  const liveProgress = useRef(null);

  // ---- live-game persistence: a page reload no longer loses the leg ----
  // Scoped to the signed-in account (a shared device never hands one
  // user's game to another). The undo history is stripped before writing:
  // it grows quadratically and in-session resume keeps it in memory.
  const LIVE_KEY = "bb-live-game";
  const sessionUserIdRef = useRef(null);
  // true from finishMatch/quit until the next game starts; blocks the play
  // component's trailing onProgress (fired while finishMatch awaits the
  // network) from resurrecting the cleared key or re-arming the cast timer
  const finishingRef = useRef(false);
  const restoredForUser = useRef(null);

  const persistLive = useCallback((game, progress) => {
    const uid = sessionUserIdRef.current;
    if (!uid) return;
    try {
      if (game) {
        window.localStorage.setItem(LIVE_KEY, JSON.stringify({ userId: uid, game, progress: stripHistory(progress) }));
      } else {
        window.localStorage.removeItem(LIVE_KEY);
      }
    } catch {}
  }, []);

  // ---- TV casting: broadcast live game state to /tv screens ----
  const [castCode, setCastCode] = useState(null);
  const castChannel = useRef(null);
  const liveGameRef = useRef(null);
  const castTimer = useRef(null);
  const lastCastAt = useRef(0);

  const sendCastState = useCallback(() => {
    if (!castChannel.current || !liveGameRef.current || !liveProgress.current) return;
    castChannel.current.send("state", {
      game: liveGameRef.current,
      snapshot: stripHistory(liveProgress.current),
    });
  }, []);

  const saveProgress = useCallback((p) => {
    if (finishingRef.current) return; // trailing update after finish/quit
    liveProgress.current = p;
    persistLive(liveGameRef.current, p);
    if (!castChannel.current) return;
    const wait = Math.max(0, 200 - (Date.now() - lastCastAt.current));
    if (castTimer.current) clearTimeout(castTimer.current);
    castTimer.current = setTimeout(() => {
      lastCastAt.current = Date.now();
      sendCastState();
    }, wait);
  }, [sendCastState, persistLive]);

  const toggleCast = useCallback(() => {
    if (castChannel.current) {
      // "stopped" (not "ended") sends TVs back to their code-entry screen
      castChannel.current.send("stopped", {});
      castChannel.current.close();
      castChannel.current = null;
      setCastCode(null);
      return;
    }
    const code = makeCastCode();
    const ch = openCastChannel(code, (event) => {
      // a late-joining TV asks for state; answer with the live snapshot,
      // or an explicit "ended" so it knows the code is right but nothing
      // is being played yet
      if (event === "hello") {
        if (liveGameRef.current && liveProgress.current) sendCastState();
        else if (lastFinishedRef.current) castChannel.current && castChannel.current.send("finished", lastFinishedRef.current);
        else castChannel.current && castChannel.current.send("ended", {});
      }
    });
    if (!ch) return;
    castChannel.current = ch;
    setCastCode(code);
  }, [sendCastState]);

  useEffect(() => {
    liveGameRef.current = live;
  }, [live]);

  useEffect(() => {
    return () => {
      if (castTimer.current) clearTimeout(castTimer.current);
      if (castChannel.current) castChannel.current.close();
    };
  }, []);
  // end-of-game summary: shown the moment a game finishes, while the
  // result saves in the background. lastFinishedRef answers a TV that
  // joins after the final dart.
  const [finished, setFinished] = useState(null); // { summary, match, game, eloAfter }
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState("");
  const lastFinishedRef = useRef(null);
  const [profileUser, setProfileUser] = useState(null);
  // where a profile was opened from, so Back returns there (Home podium,
  // standings, records…) instead of always landing on the standings
  const [profileFrom, setProfileFrom] = useState("leaderboard");
  // what Setup opens preselected with (from the practice hub); the key remounts it
  const [setupInitial, setSetupInitial] = useState(null);
  const openSetup = (initial = null) => {
    setSetupInitial(initial ? { ...initial, key: Date.now() } : null);
    setView("setup");
  };
  const [notice, setNotice] = useState("");
  // Quit asks first: a single mis-tap at the board must not wipe a leg
  const [quitAsk, setQuitAsk] = useState(false);

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

  useEffect(() => {
    sessionUserIdRef.current = session?.user?.id || null;
  }, [session]);

  // restore a persisted live game for THIS account, once per sign-in
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || live || restoredForUser.current === uid) return;
    restoredForUser.current = uid;
    try {
      const raw = window.localStorage.getItem(LIVE_KEY);
      if (!raw) return;
      const { userId, game, progress } = JSON.parse(raw);
      if (userId !== uid) return; // someone else's leg on a shared device
      if (game && game.gameType && Array.isArray(game.players)) {
        liveProgress.current = progress || null;
        liveGameRef.current = game;
        setLive(game);
        setNotice("Live game restored — open Play to continue.");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, live]);

  // apply theme + text size from the user's saved preferences. The brand
  // accent is fixed by the design system (navy on light, lavender on dark);
  // an older per-account "accent" or "skin" preference is ignored.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = (session && session.user && session.user.user_metadata) || {};
    document.documentElement.dataset.theme = meta.theme === "dark" ? "dark" : "light";
    document.documentElement.style.removeProperty("--accent");
    applyFontScale(meta.fontScale);
  }, [session]);

  // Signed-out visitors belong on /login (or on / right after signing out).
  // The redirect fires as soon as auth state is known, without waiting for
  // the branded splash.
  const router = useRouter();
  const signingOutRef = useRef(false);
  useEffect(() => {
    if (!isConfigured || !authReady || session) return;
    router.replace(signingOutRef.current ? "/" : "/login?next=%2Fapp");
  }, [authReady, session, router]);

  const refresh = useCallback(async () => {
    try {
      const [p, r, f] = await Promise.all([getPlayers(), getGameResults(), getFollows()]);
      setPlayers(p);
      setAllResults(r);
      setFollows(f);
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

  const backfillRan = useRef(false);
  const handleAdoptTried = useRef(false);
  useEffect(() => {
    if (!session || !dataReady) return;
    const meName = (session.user?.user_metadata?.display_name || "").trim();
    const meId = session.user?.id;
    if (!meName || !meId) return;
    // the handle chosen at sign-up rides along in auth metadata until a
    // player row exists to hold it
    const metaHandle = normalizeHandle(session.user?.user_metadata?.handle);
    const wantHandle = metaHandle && validateHandle(metaHandle).ok ? metaHandle : null;
    const existing =
      players.find((p) => p.authId === meId) ||
      players.find((p) => p.username.toLowerCase() === meName.toLowerCase());
    if (existing) {
      if (!existing.authId) {
        (async () => {
          await dbLinkPlayerAuth(existing.username, meId);
          if (!existing.handle && wantHandle) await dbUpdatePlayerProfile(existing.username, { handle: wantHandle });
          await refresh();
        })();
      } else if (!existing.handle && wantHandle && !handleAdoptTried.current) {
        handleAdoptTried.current = true;
        (async () => {
          const r = await dbUpdatePlayerProfile(existing.username, { handle: wantHandle });
          if (r.ok) await refresh();
        })();
      }
    } else {
      (async () => {
        await dbAddPlayer(meName, false, meId, wantHandle);
        await refresh();
      })();
      return;
    }
    if (!backfillRan.current && players.some((p) => !p.authId)) {
      backfillRan.current = true;
      (async () => {
        try {
          const token = session.access_token;
          const res = await fetch("/api/link-players", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          const data = await res.json();
          if (data.linked > 0) await refresh();
        } catch {}
      })();
    }
  }, [session, dataReady, players, refresh]);

  const usernames = useMemo(() => players.map((p) => p.username), [players]);
  const myAuthId = session?.user?.id || null;
  const myPlayerRow = useMemo(() => {
    const name = (session?.user?.user_metadata?.display_name || "").trim().toLowerCase();
    return players.find((p) => p.authId === myAuthId) || players.find((p) => p.username.toLowerCase() === name) || null;
  }, [players, session, myAuthId]);
  // who I follow (null = follows not installed: everyone) and who follows me
  const following = useMemo(() => (follows === null ? null : followingUsernames(follows, players, myAuthId)), [follows, players, myAuthId]);
  const followers = useMemo(() => followerUsernames(follows, players, myPlayerRow?.id), [follows, players, myPlayerRow]);
  const social = useMemo(() => followsForSocial(follows, players, { myAuthId, myPlayerId: myPlayerRow?.id }), [follows, players, myAuthId, myPlayerRow]);
  // my circle: me plus the players I follow. The database only returns
  // their result rows, so every screen below is friends-only by construction
  const circlePlayers = useMemo(() => circleOf(players, following, myPlayerRow?.username || (session?.user?.user_metadata?.display_name || "").trim()), [players, following, myPlayerRow, session]);
  // players who appear in standings (self-hidden are excluded)
  const visibleUsernames = useMemo(
    () => circlePlayers.filter((p) => !p.hidden).map((p) => p.username),
    [circlePlayers]
  );
  const stats = useMemo(() => computeStats(results), [results]);
  const elo = useMemo(() => eloMapFromPlayers(players), [players]);
  const playerColors = useMemo(
    () => ({ ...botColors(), ...Object.fromEntries(players.map((p) => [p.username, p.color || defaultPlayerColor(p.username)])) }),
    [players]
  );
  // how each player looks (colour + name tag), for PlayerBadge everywhere
  const playerMeta = useMemo(
    () => Object.fromEntries(players.map((p) => [p.username, { color: playerColors[p.username], tag: p.tag || null, tagIcon: p.tagIcon || null }])),
    [players, playerColors]
  );
  const myName = (session?.user?.user_metadata?.display_name || "").trim();
  const ladder = useMemo(() => botLadder(practice, myName), [practice, myName]);
  const gameCount = useMemo(() => new Set(results.map((r) => r.gameId)).size, [results]);

  const isAdmin = useMemo(
    () => (session?.user?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    [session]
  );

  const addPlayer = useCallback(async (name, hidden = false) => {
    const u = name.trim();
    if (!u) return false;
    if (players.some((p) => p.username.toLowerCase() === u.toLowerCase())) return false;
    const ok = await dbAddPlayer(u, hidden);
    if (ok) await refresh();
    return ok;
  }, [players, refresh]);

  const setPlayerHidden = useCallback(async (username, hidden) => {
    await dbSetPlayerHidden(username, hidden);
    await refresh();
  }, [refresh]);

  const setPlayerColor = useCallback(async (username, color) => {
    await dbSetPlayerColor(username, color);
    await refresh();
  }, [refresh]);

  const updatePlayerProfile = useCallback(async (username, patch) => {
    const r = await dbUpdatePlayerProfile(username, patch);
    if (r.ok) await refresh();
    return r;
  }, [refresh]);

  // the signed-in account's own player row: by account link first, then by name
  const myPlayer = useMemo(() => {
    const uid = session?.user?.id;
    const name = (session?.user?.user_metadata?.display_name || "").trim().toLowerCase();
    return players.find((p) => p.authId === uid) || players.find((p) => p.username.toLowerCase() === name) || null;
  }, [players, session]);

  const saveMatch = useCallback(async (match, eloAfter, ranked) => {
    setSaveState("saving");
    setSaveError("");
    try {
      await recordGame({
        gameId: match.gameId,
        gameType: match.gameType,
        config: match.config,
        players: match.players,
        winner: match.winner,
        perPlayer: match.perPlayer,
        ranked,
        eloAfter,
        currentElo: elo,
        completedAt: match.completedAt,
      });
      await refresh();
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e?.message || "");
    }
  }, [refresh, elo]);

  const finishMatch = useCallback(async (match) => {
    // block the play component's trailing onProgress (it re-renders while
    // we await the network below) from resurrecting the persisted game or
    // re-arming the cast timer after "finished"
    finishingRef.current = true;
    if (castTimer.current) clearTimeout(castTimer.current);
    liveProgress.current = null;
    persistLive(null);
    const game = liveGameRef.current;
    const ranked = isRankedMatch(match);
    const eloAfter = ranked ? applyEloUpdate(elo, match.players, match.winner) : null;
    const summary = buildSummary({ match, game, eloBefore: ranked ? elo : null, eloAfter, colors: playerColors, meta: playerMeta });
    lastFinishedRef.current = { game, winner: match.winner, summary };
    if (castChannel.current) castChannel.current.send("finished", lastFinishedRef.current);

    // show the summary now; the save runs behind it
    setLive(null);
    setNotice("");
    setFinished({ summary, match, game, eloAfter, ranked });
    setView("summary");
    // ranked games save win/loss + Elo; solo, bot and drill games save as practice
    match.gameId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await saveMatch(match, eloAfter, ranked);
  }, [elo, playerColors, playerMeta, persistLive, saveMatch]);

  const startGame = useCallback((game) => {
    finishingRef.current = false;
    liveProgress.current = null;
    lastFinishedRef.current = null;
    // sync the ref now: the play component's first onProgress fires
    // before the ref-syncing effect on this same commit
    liveGameRef.current = game;
    persistLive(game, null);
    setLive(game);
    setFinished(null);
    setView(PLAY_VIEWS[game.gameType] || "playX01");
  }, [persistLive]);

  const openProfile = (u) => {
    if (view !== "profile") setProfileFrom(view);
    setProfileUser(u);
    setView("profile");
  };

  const [friendsFrom, setFriendsFrom] = useState("home");
  const openFriends = () => {
    if (view !== "friends") setFriendsFrom(view);
    setView("friends");
  };
  const follow = useCallback(async (username) => {
    const p = players.find((x) => x.username === username);
    if (!p?.id || !myAuthId) return { ok: false, reason: "Player not found." };
    const r = await dbFollowPlayer(myAuthId, p.id);
    if (r.ok) await refresh();
    return r;
  }, [players, myAuthId, refresh]);
  const unfollow = useCallback(async (username) => {
    const p = players.find((x) => x.username === username);
    if (!p?.id || !myAuthId) return { ok: false, reason: "Player not found." };
    const r = await dbUnfollowPlayer(myAuthId, p.id);
    if (r.ok) await refresh();
    return r;
  }, [players, myAuthId, refresh]);

  const signOut = async () => {
    signingOutRef.current = true;
    await supabase.auth.signOut();
    router.replace("/");
  };

  const quit = () => {
    setQuitAsk(false);
    finishingRef.current = true;
    lastFinishedRef.current = null;
    if (castTimer.current) clearTimeout(castTimer.current);
    liveProgress.current = null;
    persistLive(null);
    if (castChannel.current) castChannel.current.send("ended", {});
    setLive(null);
    setNotice("");
    setView("home");
  };

  const ALL_PLAY_VIEWS = Object.values(PLAY_VIEWS);
  const playViewFor = (gt) => PLAY_VIEWS[gt] || "playX01";
  const goPlay = () => (live ? setView(playViewFor(live.gameType)) : openSetup(null));
  const askQuit = () => setQuitAsk(true);

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

  if (!authReady || !splashDone) return <LoadingScreen text="starting up…" />;
  if (!session) return <LoadingScreen text="redirecting…" />;
  if (!dataReady) return <LoadingScreen text="loading…" />;

  return (
    <PlayerLookContext.Provider value={playerMeta}>
    <main className="app shell">
      <div className="scroll">
        <div className="container">
        <header className="header">
          <button type="button" className="brand-home" aria-label="Blackbird home" onClick={() => setView("home")}>
            <Logo variant="lockup" height={40} />
          </button>
          <button
            className="btn btn-sm"
            style={{ padding: "6px 11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setView("account")}
            title="Settings"
            aria-label="Settings"
          >
            <GearIcon />
          </button>
          <button
            className="btn btn-sm"
            style={{
              padding: "4px 6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => {
              const me = session.user?.user_metadata?.display_name;
              if (me) openProfile(me);
              else setView("account");
            }}
            title="Your stats & card"
            aria-label="Your profile"
          >
            <PlayerBadge username={session.user?.user_metadata?.display_name || "?"} color={playerColors[session.user?.user_metadata?.display_name]} size={28} showName={false} />
          </button>
        </header>

        {loadError && (
          <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
            <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>{loadError}</p>
          </div>
        )}
        {view === "home" && myPlayer && !myPlayer.handle && (
          <div
            className="card pad-sm mb-12 clickable"
            style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "var(--accent)" }}
            {...pressProps(() => setView("account"))}
          >
            <PlayerBadge username={myPlayer.username} color={playerColors[myPlayer.username]} size={28} showName={false} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Pick your @handle</div>
              <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
                It&apos;s how friends will find you. Takes ten seconds.
              </div>
            </div>
            <span className="tag" style={{ color: "var(--accent)" }}>Set up</span>
          </div>
        )}
        {notice && view === "home" && (
          <div className="card mb-12" style={{ borderColor: "var(--amber)" }}>
            <p className="subtle" style={{ margin: 0, color: "var(--amber)" }}>{notice}</p>
          </div>
        )}

        {view === "home" && (
          <Home setView={setView} openSetup={openSetup} stats={stats} elo={elo} players={circlePlayers} gameCount={gameCount} results={results} openProfile={openProfile} openFriends={openFriends} playerColors={playerColors} />
        )}
        {view === "setup" && (
          <Setup
            key={setupInitial?.key || "default"}
            initial={setupInitial}
            players={circlePlayers}
            playerColors={playerColors}
            onOpenFriends={openFriends}
            me={session.user?.user_metadata?.display_name || ""}
            ladder={ladder}
            onStart={startGame}
            back={() => setView(setupInitial ? "practice" : "home")}
          />
        )}
        {view === "practice" && (
          <Practice practice={practice} me={myName} onStart={openSetup} back={() => setView("home")} playerColors={playerColors} />
        )}
        {((ALL_PLAY_VIEWS.includes(view) && live) || view === "summary") && castAvailable() && (
          <div className="card pad-sm mb-12" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {castCode ? (
              <>
                <CastIcon />
                <span className="tag" style={{ letterSpacing: 0, textTransform: "none" }}>TV code</span>
                <span className="num" style={{ fontSize: "calc(17px * var(--fs))", letterSpacing: "0.25em" }}>{castCode}</span>
                <span className="tag" style={{ flex: 1, letterSpacing: 0, textTransform: "none", textAlign: "right" }}>
                  open {typeof window !== "undefined" ? window.location.host : ""}/tv
                </span>
                <button className="btn" style={{ padding: "6px 12px" }} onClick={toggleCast}>
                  Stop
                </button>
              </>
            ) : (
              <button
                className="btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                onClick={toggleCast}
              >
                <CastIcon /> Cast to TV
              </button>
            )}
          </div>
        )}
        {view === "playX01" && live && <PlayX01 game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playCricket" && live && <PlayCricket game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playBaseball" && live && <PlayBaseball game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playAroundTheClock" && live && <PlayAroundTheClock game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playKiller" && live && <PlayKiller game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playShanghai" && live && <PlayShanghai game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playHalveIt" && live && <PlayHalveIt game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playGotcha" && live && <PlayGotcha game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playTicTacToe" && live && <PlayTicTacToe game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playBobs27" && live && <PlayBobs27 game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playCheckoutDrill" && live && <PlayCheckoutDrill game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "playScoringDrill" && live && <PlayScoringDrill game={live} resume={liveProgress.current} onProgress={saveProgress} onFinish={finishMatch} onQuit={askQuit} castActive={!!castCode} playerColors={playerColors} />}
        {view === "summary" && finished && (
          <GameSummary
            summary={finished.summary}
            saveState={saveState}
            saveError={saveError}
            onRetrySave={() => saveMatch(finished.match, finished.eloAfter, finished.ranked)}
            onRematch={() => startGame(rematchGame(finished.game || { ...finished.match, id: "" }))}
            onNewGame={() => setView("setup")}
            onDone={() => setView(finished.summary.ranked ? "leaderboard" : "home")}
            playerColors={playerColors}
          />
        )}
        {view === "leaderboard" && (
          <Leaderboard usernames={visibleUsernames} stats={stats} elo={elo} openProfile={openProfile} openRecords={() => setView("records")} openFriends={openFriends} back={() => setView("home")} playerColors={playerColors} />
        )}
        {view === "profile" && profileUser && (
          <Profile
            user={profileUser}
            player={players.find((p) => p.username === profileUser) || null}
            stats={stats[profileUser]}
            elo={elo[profileUser]}
            results={results}
            practice={practice}
            onOpenPractice={profileUser === myName ? () => setView("practice") : null}
            onOpenAccount={
              profileUser === (session.user?.user_metadata?.display_name || "")
                ? () => setView("account")
                : null
            }
            playerColors={playerColors}
            isMe={profileUser === myName}
            isFollowing={following === null ? null : following.has(profileUser)}
            onFollow={() => follow(profileUser)}
            onUnfollow={() => unfollow(profileUser)}
            back={() => setView(profileFrom)}
          />
        )}
        {view === "records" && (
          <Records usernames={visibleUsernames} stats={stats} results={results} back={() => setView("leaderboard")} playerColors={playerColors} />
        )}
        {view === "matchup" && (
          <Matchup usernames={visibleUsernames} elo={elo} results={results} stats={stats} back={() => setView("home")} playerColors={playerColors} />
        )}
        {view === "ai" && (
          <BlackbirdAI me={myName} userId={session.user?.id} stats={stats} elo={elo} results={results} practice={practice} players={circlePlayers} social={social} playerColors={playerColors} />
        )}
        {view === "friends" && (
          <Friends
            players={players}
            me={myName}
            following={following}
            followers={followers}
            social={social}
            follow={follow}
            unfollow={unfollow}
            openProfile={openProfile}
            playerColors={playerColors}
            installed={follows !== null}
            back={() => setView(friendsFrom)}
          />
        )}
        {view === "account" && (
          <Account
            user={session.user}
            players={players}
            results={allResults}
            addPlayer={addPlayer}
            setPlayerHidden={setPlayerHidden}
            setPlayerColor={setPlayerColor}
            updatePlayerProfile={updatePlayerProfile}
            myPlayer={myPlayer}
            playerColors={playerColors}
            isAdmin={isAdmin}
            onOpenAdmin={() => setView("admin")}
            social={social}
            onOpenFriends={openFriends}
            signOut={signOut}
            back={() => setView("home")}
          />
        )}
        {view === "admin" && isAdmin && (
          <Admin stats={stats} addPlayer={addPlayer} refreshData={refresh} back={() => setView("account")} playerColors={playerColors} />
        )}

        </div>
      </div>
      {quitAsk && live && (
        <Modal>
          <h3 className="section-title" style={{ fontSize: "calc(18px * var(--fs))" }}>Quit this game?</h3>
          <p className="subtle" style={{ marginTop: 0 }}>
            The game in progress will be discarded and nothing will be saved to stats.
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => setQuitAsk(false)} autoFocus>
              Keep Playing
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={quit}>
              Quit Game
            </button>
          </div>
        </Modal>
      )}
      <nav className="nav">
        <button className={`navbtn ${["home", "practice", "friends"].includes(view) ? "active" : ""}`} onClick={() => setView("home")}>Home</button>
        <button className={`navbtn ${view === "setup" || view === "summary" || ALL_PLAY_VIEWS.includes(view) ? "active" : ""}`} onClick={goPlay}>Play{live ? " ●" : ""}</button>
        <button className={`navbtn ${["leaderboard", "profile", "records"].includes(view) ? "active" : ""}`} onClick={() => setView("leaderboard")}>Stats</button>
        <button className={`navbtn ${view === "matchup" ? "active" : ""}`} onClick={() => setView("matchup")}>Matchup</button>
        <button className={`navbtn ${view === "ai" ? "active" : ""}`} onClick={() => setView("ai")} aria-label="Blackbird AI">AI</button>
      </nav>
    </main>
    </PlayerLookContext.Provider>
  );
}
