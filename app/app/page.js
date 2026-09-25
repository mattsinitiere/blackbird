"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { getPlayers, addPlayer as dbAddPlayer, linkPlayerAuth as dbLinkPlayerAuth, setPlayerHidden as dbSetPlayerHidden, setPlayerColor as dbSetPlayerColor, updatePlayerProfile as dbUpdatePlayerProfile, getGameResults, recordGame, getFollows, followPlayer as dbFollowPlayer, unfollowPlayer as dbUnfollowPlayer } from "@/lib/db";
import { followingUsernames, followerUsernames, circlePlayers as circleOf, followsForSocial } from "@/lib/follows";
import { normalizeHandle, validateHandle } from "@/lib/profile";
import { PROFILE_PARAM, resolveProfileParam } from "@/lib/profileLink";
import { computeStats, eloMapFromPlayers, applyEloUpdate } from "@/lib/stats";
import { ADMIN_EMAIL, defaultPlayerColor } from "@/lib/constants";
import { applyFontScale } from "@/lib/prefs";
import { makeCastCode, openCastChannel, castAvailable, stripHistory } from "@/lib/cast";
import { buildSummary } from "@/lib/summary";
import { isRankedMatch, splitResults, botLadder, buildResultRows, humanPlayers, resultFromRow, newlyUnlockedBot } from "@/lib/practice";
import { computeAchievements, diffUnlocked, seenKey, readSeen, writeSeen } from "@/lib/achievements";
import { botColors, isBot } from "@/lib/bots";
import { rematchGame } from "@/lib/games";
import { Logo, CastIcon, PlayerBadge, Modal, pressProps, PlayerLookContext, HomeIcon, PlayIcon, StatsIcon, MatchupIcon, SparkleIcon } from "@/components/ui";
import Home from "@/components/Home";
import Setup from "@/components/Setup";
import BotSetup from "@/components/BotSetup";
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
import GameDetail from "@/components/GameDetail";
import { rowsFromMatch } from "@/lib/gamestats";

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
  // avatar colours ride along with every state so the TV matches the phone
  const playerColorsRef = useRef({});

  const sendCastState = useCallback(() => {
    if (!castChannel.current || !liveGameRef.current || !liveProgress.current) return;
    const colors = {};
    for (const u of liveGameRef.current.players || []) {
      if (playerColorsRef.current[u]) colors[u] = playerColorsRef.current[u];
    }
    castChannel.current.send("state", {
      game: liveGameRef.current,
      snapshot: stripHistory(liveProgress.current),
      colors,
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
  // Play a Bot: its own screen; Back returns to wherever it was opened from
  const [botInitial, setBotInitial] = useState(null);
  const [botFrom, setBotFrom] = useState("setup");
  const openBots = (initial = null, from = null) => {
    setBotInitial({ ...(initial || {}), key: Date.now() });
    setBotFrom(from || view);
    setView("bots");
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
    // a shared profile link (/app?player=…) survives the trip through sign-in
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(signingOutRef.current ? "/" : `/login?next=${encodeURIComponent(`/app${search}`)}`);
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
  useEffect(() => {
    playerColorsRef.current = playerColors;
  }, [playerColors]);
  // how each player looks (colour + name tag), for PlayerBadge everywhere
  const playerMeta = useMemo(
    () => Object.fromEntries(players.map((p) => [p.username, { color: playerColors[p.username], tag: p.tag || null, tagIcon: p.tagIcon || null }])),
    [players, playerColors]
  );
  const myName = (session?.user?.user_metadata?.display_name || "").trim();
  // the profile tab owns my own profile and everything reached from it
  const onMyProfile = !!myName && profileUser === myName;
  const meTabActive = (view === "profile" && onMyProfile) || ["friends", "account", "admin"].includes(view);
  const ladder = useMemo(() => botLadder(practice, myName), [practice, myName]);

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

    // badges this game unlocks: compare before/after using the rows the save
    // will write (only for players whose history we can see)
    let newBadges = [];
    try {
      const pending = buildResultRows({ gameId: "pending", gameType: match.gameType, config: match.config, players: match.players, winner: match.winner, perPlayer: match.perPlayer, ranked, eloAfter, currentElo: elo, completedAt: match.completedAt }).map((r) => resultFromRow(r));
      const { competitive: addC, practice: addP } = splitResults(pending);
      const circle = new Set(circlePlayers.map((p) => p.username));
      for (const u of humanPlayers(match.players)) {
        if (u !== myName && !circle.has(u)) continue;
        const soc = u === myName ? social : null;
        const before = computeAchievements({ me: u, results, practice, social: soc });
        const after = computeAchievements({ me: u, results: [...results, ...addC], practice: [...practice, ...addP], social: soc });
        for (const b of diffUnlocked(before, after)) newBadges.push({ username: u, badge: b });
      }
      const mine = newBadges.filter((b) => b.username === myName).map((b) => b.badge.id);
      if (mine.length && typeof window !== "undefined") {
        const key = seenKey(session?.user?.id);
        writeSeen(window.localStorage, key, [...readSeen(window.localStorage, key), ...mine]);
      }
    } catch (e) {
      newBadges = [];
    }

    // a bot win can open the next rung of the ladder
    let unlockedBot = null;
    const botId = (match.players || []).find(isBot);
    if (botId) {
      try {
        const pending = buildResultRows({ gameId: "pending", gameType: match.gameType, config: match.config, players: match.players, winner: match.winner, perPlayer: match.perPlayer, ranked: false, currentElo: elo, completedAt: match.completedAt }).map((r) => resultFromRow(r));
        unlockedBot = newlyUnlockedBot(botLadder(practice, myName), botLadder([...practice, ...pending], myName));
      } catch {
        unlockedBot = null;
      }
    }

    // show the summary now; the save runs behind it
    setLive(null);
    setNotice("");
    setFinished({ summary, match, game, eloAfter, ranked, newBadges, botId: botId || null, unlockedBot });
    setView("summary");
    // ranked games save win/loss + Elo; solo, bot and drill games save as practice
    match.gameId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await saveMatch(match, eloAfter, ranked);
  }, [elo, playerColors, playerMeta, persistLive, saveMatch, results, practice, circlePlayers, social, myName, session]);

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

  // match report: the rows of one game (saved, or the one just finished)
  const [gameRows, setGameRows] = useState(null);
  const [gameFrom, setGameFrom] = useState("home");
  const openGame = (row) => {
    if (!row?.gameId) return;
    const rows = allResults.filter((x) => x.gameId === row.gameId);
    if (!rows.length) return;
    if (view !== "game") setGameFrom(view);
    setGameRows(rows);
    setView("game");
  };
  const openReport = () => {
    if (!finished?.match) return;
    setGameFrom("summary");
    setGameRows(rowsFromMatch(finished.match));
    setView("game");
  };

  // a shared profile link: open that player once the roster has loaded
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (!dataReady || deepLinkDone.current || typeof window === "undefined") return;
    deepLinkDone.current = true;
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get(PROFILE_PARAM);
    if (wanted == null) return;
    params.delete(PROFILE_PARAM);
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    const u = resolveProfileParam(wanted, players);
    if (u) {
      setProfileFrom("home");
      setProfileUser(u);
      setView("profile");
    } else {
      setNotice("That profile link doesn't match a player you can see.");
    }
  }, [dataReady, players]);
  // "Edit profile" opens settings scrolled to the profile editor
  const [accountFocus, setAccountFocus] = useState(null);

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
    <main className={`app shell${view === "profile" ? " is-profile" : ""}`}>
      <div className="scroll">
        <div className={`container${view === "profile" ? " container-profile" : ""}`}>
        <header className="header">
          <button type="button" className="brand-home" aria-label="Blackbird home" onClick={() => setView("home")}>
            <Logo variant="lockup" height={40} />
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
          <Home setView={setView} openSetup={openSetup} stats={stats} elo={elo} players={circlePlayers} results={results} me={myName} openProfile={openProfile} playerColors={playerColors} practice={practice} social={social} following={following ? [...following] : []} userId={session.user?.id} />
        )}
        {view === "setup" && (
          <Setup
            key={setupInitial?.key || "default"}
            initial={setupInitial}
            players={circlePlayers}
            playerColors={playerColors}
            onOpenFriends={openFriends}
            me={session.user?.user_metadata?.display_name || ""}
            onOpenBots={(gameType) => openBots({ gameType }, "setup")}
            onStart={startGame}
            back={setupInitial?.players ? () => setView("home") : setupInitial ? () => setView("practice") : null}
          />
        )}
        {view === "bots" && (
          <BotSetup key={botInitial?.key || "bots"} me={myName} ladder={ladder} initial={botInitial} onStart={startGame} back={() => setView(botFrom)} />
        )}
        {view === "practice" && (
          <Practice practice={practice} me={myName} onStart={(initial) => (initial?.bot ? openBots(initial, "practice") : openSetup(initial))} openGame={openGame} back={() => setView("home")} playerColors={playerColors} />
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
            key={finished.summary.completedAt}
            newBadges={finished.newBadges || []}
            onOpenReport={openReport}
            summary={finished.summary}
            saveState={saveState}
            saveError={saveError}
            onRetrySave={() => saveMatch(finished.match, finished.eloAfter, finished.ranked)}
            onRematch={() => startGame(rematchGame(finished.game || { ...finished.match, id: "" }))}
            onNewGame={() => setView("setup")}
            bot={finished.botId ? { id: finished.botId, unlocked: finished.unlockedBot } : null}
            onChooseBot={() => openBots({ bot: finished.botId, gameType: finished.match?.gameType }, "practice")}
            onPlayBot={(id) => openBots({ bot: id, gameType: finished.match?.gameType }, "practice")}
            onPracticeHub={() => setView("practice")}
            onDone={() => setView(finished.summary.ranked ? "leaderboard" : "home")}
            playerColors={playerColors}
          />
        )}
        {view === "leaderboard" && (
          <Leaderboard usernames={visibleUsernames} stats={stats} elo={elo} openProfile={openProfile} openRecords={() => setView("records")} back={null} playerColors={playerColors} />
        )}
        {view === "profile" && profileUser && (
          <Profile
            key={profileUser}
            user={profileUser}
            me={myName}
            player={players.find((p) => p.username === profileUser) || null}
            stats={stats[profileUser]}
            elo={elo[profileUser]}
            results={results}
            practice={practice}
            onOpenPractice={profileUser === myName ? () => setView("practice") : null}
            onOpenAccount={
              profileUser === (session.user?.user_metadata?.display_name || "")
                ? () => {
                    setAccountFocus(null);
                    setView("account");
                  }
                : null
            }
            onEditProfile={() => {
              setAccountFocus("profile");
              setView("account");
            }}
            playerColors={playerColors}
            isMe={profileUser === myName}
            social={social}
            socialAvailable={follows !== null}
            followsYou={followers.has(profileUser)}
            dataError={!!loadError}
            openProfile={openProfile}
            userId={session.user?.id}
            openGame={openGame}
            onOpenFriends={profileUser === myName ? openFriends : null}
            isFollowing={following === null ? null : following.has(profileUser)}
            onFollow={() => follow(profileUser)}
            onUnfollow={() => unfollow(profileUser)}
            back={profileUser === myName ? null : () => setView(profileFrom)}
          />
        )}
        {view === "records" && (
          <Records usernames={visibleUsernames} stats={stats} results={results} practice={practice} openGame={openGame} back={() => setView("leaderboard")} playerColors={playerColors} />
        )}
        {view === "game" && gameRows && (
          <GameDetail rows={gameRows} playerColors={playerColors} back={() => setView(gameFrom)} />
        )}
        {view === "matchup" && (
          <Matchup usernames={visibleUsernames} elo={elo} results={results} stats={stats} back={null} playerColors={playerColors} />
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
            focus={accountFocus}
            back={() => {
              setAccountFocus(null);
              // settings open from the profile tab, so Back returns there
              if (!myName) return setView("home");
              setProfileUser(myName);
              setView("profile");
            }}
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
      <nav className="nav" aria-label="Main">
        {[
          { key: "home", label: "Home", icon: <HomeIcon />, active: ["home", "practice"].includes(view), go: () => setView("home") },
          { key: "play", label: live ? "Play (game in progress)" : "Play", icon: <PlayIcon />, active: view === "setup" || view === "bots" || view === "summary" || ALL_PLAY_VIEWS.includes(view), go: goPlay, dot: !!live },
          { key: "stats", label: "Stats", icon: <StatsIcon />, active: ["leaderboard", "records", "game"].includes(view) || (view === "profile" && !onMyProfile), go: () => setView("leaderboard") },
          { key: "matchup", label: "Matchup", icon: <MatchupIcon />, active: view === "matchup", go: () => setView("matchup") },
          { key: "ai", label: "Blackbird AI", icon: <SparkleIcon />, active: view === "ai", go: () => setView("ai") },
        ].map((t) => (
          <button key={t.key} type="button" className={`navbtn navbtn-icon ${t.active ? "active" : ""}`} onClick={t.go} aria-label={t.label} title={t.label} aria-current={t.active ? "page" : undefined}>
            {t.icon}
            {t.dot && <span className="nav-dot" aria-hidden="true" />}
          </button>
        ))}
        <button
          type="button"
          className={`navbtn navbtn-icon navbtn-me ${meTabActive ? "active" : ""}`}
          onClick={() => (myName ? openProfile(myName) : setView("account"))}
          aria-label="Your profile"
          title="Your profile"
          aria-current={meTabActive ? "page" : undefined}
        >
          <PlayerBadge username={myName || "?"} color={playerColors[myName]} size={28} showName={false} />
        </button>
      </nav>
    </main>
    </PlayerLookContext.Provider>
  );
}
