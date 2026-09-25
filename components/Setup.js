import { useState, useRef, useCallback } from "react";
import { BackBar, PlayerBadge, ShuffleIcon, DragIcon, pressProps } from "./ui";
import { assignKillerNumbers, newGameId } from "@/lib/games";
import { PRACTICE_ONLY } from "@/lib/practice";
import { SCORING_TARGETS, SCORING_TURNS, scoringTargetLabel } from "@/lib/drills";
import { BOT_GAMES } from "@/lib/bots";
import BotAvatar from "./BotAvatar";
import { ChevronIcon } from "./profile/icons";
import { X01Options, CricketOptions, BaseballNote } from "./GameOptions";

function useDragReorder(selected, setSelected) {
  const dragIdx = useRef(null);
  const overIdx = useRef(null);
  const touchStartY = useRef(null);
  const dragging = useRef(false);

  const reorder = useCallback((from, to) => {
    if (from === to) return;
    setSelected((s) => {
      const a = [...s];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
  }, [setSelected]);

  const onDragStart = useCallback((e, i) => {
    dragIdx.current = i;
    dragging.current = true;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
  }, []);

  const onDragOver = useCallback((e, i) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx.current !== i && dragIdx.current !== null) {
      overIdx.current = i;
      reorder(dragIdx.current, i);
      dragIdx.current = i;
    }
  }, [reorder]);

  const onDragEnd = useCallback(() => {
    dragIdx.current = null;
    overIdx.current = null;
    dragging.current = false;
  }, []);

  const pillRefs = useRef([]);

  const onTouchStart = useCallback((e, i) => {
    dragIdx.current = i;
    touchStartY.current = e.touches[0].clientY;
    dragging.current = false;
  }, []);

  const onTouchMove = useCallback((e, i) => {
    if (dragIdx.current === null) return;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    const dx = Math.abs(e.touches[0].clientX - (touchStartY.current || 0));
    if (!dragging.current && (dy > 8 || dx > 8)) dragging.current = true;
    if (!dragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const els = pillRefs.current;
    for (let j = 0; j < els.length; j++) {
      if (j === dragIdx.current || !els[j]) continue;
      const rect = els[j].getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        reorder(dragIdx.current, j);
        dragIdx.current = j;
        break;
      }
    }
  }, [reorder]);

  const onTouchEnd = useCallback((e) => {
    const wasDrag = dragging.current;
    dragIdx.current = null;
    dragging.current = false;
    touchStartY.current = null;
    return wasDrag;
  }, []);

  return { onDragStart, onDragOver, onDragEnd, onTouchStart, onTouchMove, onTouchEnd, pillRefs };
}

export default function Setup({ players, onStart, back, me, playerColors, initial = null, onOpenFriends = null, onOpenBots = null }) {
  const meName = (me || "").trim();
  const [selected, setSelected] = useState(meName ? [meName] : []);
  const [gameType, setGameType] = useState(initial?.gameType || "x01");
  const [startScore, setStartScore] = useState(501);
  const [doubleOut, setDoubleOut] = useState(true);
  const [legs, setLegs] = useState(1);
  const [variant, setVariant] = useState("standard");
  const [shanghaiMode, setShanghaiMode] = useState("beginner");
  const [gotchaTarget, setGotchaTarget] = useState(301);
  const [killerLives, setKillerLives] = useState(3);
  const [checkoutCount, setCheckoutCount] = useState(10);
  const [scoringTarget, setScoringTarget] = useState(20);
  const [scoringTurns, setScoringTurns] = useState(10);
  const add = (u) => setSelected((s) => (s.length < 4 && !s.includes(u) ? [...s, u] : s));
  const chooseGame = (k) => setGameType(k);
  const remove = (u) => setSelected((s) => s.filter((x) => x !== u));
  const shuffle = () => setSelected((s) => {
    const a = [...s];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  });

  const { onDragStart, onDragOver, onDragEnd, onTouchStart, onTouchMove, onTouchEnd, pillRefs } = useDragReorder(selected, setSelected);

  // the roster is my circle (me + who I follow); guests without a login
  // can still be picked once followed
  const eligible = players.map((p) => p.username);

  const rosterOptions = eligible.filter((u) => !selected.includes(u));

  const solo = selected.length === 1;
  const drill = PRACTICE_ONLY.has(gameType);
  // bot games have their own screen (components/BotSetup.js)
  const botAllowed = BOT_GAMES.has(gameType) && !!onOpenBots;
  const needsTwo = gameType === "tictactoe" || gameType === "killer" || gameType === "gotcha";
  const exactTwo = gameType === "tictactoe";
  const canStart = exactTwo ? selected.length === 2 : needsTwo ? selected.length >= 2 : selected.length >= 1;

  const start = () => {
    let config = {};
    if (gameType === "x01") config = { startScore, doubleOut, legs };
    else if (gameType === "cricket") config = { variant };
    else if (gameType === "shanghai") config = { mode: shanghaiMode };
    else if (gameType === "gotcha") config = { targetScore: gotchaTarget };
    else if (gameType === "killer") config = { numbers: assignKillerNumbers(selected), lives: killerLives };
    else if (gameType === "checkoutDrill") config = { count: checkoutCount };
    else if (gameType === "scoringDrill") config = { target: scoringTarget, turns: scoringTurns };
    onStart({
      id: newGameId(),
      gameType,
      players: selected,
      config,
      startedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="fade">
      <BackBar back={back} title="New Game" />

      <div className="card mb-12">
        <div className="tag mb-12">Game Type</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            ["x01", "X01"],
            ["cricket", "Cricket"],
            ["baseball", "Baseball"],
            ["aroundTheClock", "Around the Clock"],
            ["killer", "Killer"],
            ["shanghai", "Shanghai"],
            ["halveit", "Halve It"],
            ["gotcha", "Gotcha"],
            ["tictactoe", "Tic-Tac-Toe"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={`btn ${gameType === k ? "btn-primary" : ""}`}
              style={{ padding: "10px 6px", fontSize: "calc(13px * var(--fs))", lineHeight: 1.2, width: "100%" }}
              onClick={() => chooseGame(k)}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="tag mb-12 mt-12">Practice Drills</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            ["bobs27", "Bob's 27"],
            ["checkoutDrill", "Checkouts"],
            ["scoringDrill", "Scoring"],
          ].map(([k, l]) => (
            <button
              key={k}
              className={`btn ${gameType === k ? "btn-primary" : ""}`}
              style={{ padding: "10px 6px", fontSize: "calc(13px * var(--fs))", lineHeight: 1.2, width: "100%" }}
              onClick={() => chooseGame(k)}
            >
              {l}
            </button>
          ))}
        </div>

        {gameType === "bobs27" && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            Start on 27. Three darts at D1, then D2 up to D20, then the double bull. Each double
            hit adds twice the number; miss all three and it&apos;s taken away. Drop to 0 and you&apos;re out.
          </p>
        )}

        {gameType === "checkoutDrill" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>Finishes</div>
            <div className="row">
              {[5, 10, 20].map((v) => (
                <button
                  key={v}
                  className={`btn ${checkoutCount === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setCheckoutCount(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              Random double-out finishes from 41 to 170. Up to nine darts each; a bust puts you
              back where the visit started. The out-chart is shown while you throw.
            </p>
          </div>
        )}

        {gameType === "scoringDrill" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>Target</div>
            <div className="row">
              {SCORING_TARGETS.map((v) => (
                <button
                  key={v}
                  className={`btn ${scoringTarget === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setScoringTarget(v)}
                >
                  {scoringTargetLabel(v)}
                </button>
              ))}
            </div>
            <div className="tag" style={{ marginTop: 12, marginBottom: 6 }}>Visits</div>
            <div className="row">
              {SCORING_TURNS.map((v) => (
                <button
                  key={v}
                  className={`btn ${scoringTurns === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setScoringTurns(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              Three darts a visit at one number. Only darts in that number score.
            </p>
          </div>
        )}

        {gameType === "x01" && (
          <X01Options startScore={startScore} setStartScore={setStartScore} doubleOut={doubleOut} setDoubleOut={setDoubleOut} legs={legs} setLegs={setLegs} />
        )}

        {gameType === "cricket" && <CricketOptions variant={variant} setVariant={setVariant} />}

        {gameType === "baseball" && <BaseballNote />}

        {gameType === "aroundTheClock" && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            Hit numbers 1 through 20, then Bull, in order. First to finish wins.
            Any multiplier counts (single, double, or triple).
          </p>
        )}

        {gameType === "killer" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>Lives</div>
            <div className="row">
              {[3, 5, 7].map((v) => (
                <button
                  key={v}
                  className={`btn ${killerLives === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setKillerLives(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              Each player gets a random number. Hit your own double to become a killer,
              then hit opponents&apos; doubles to take their lives. Last one standing wins.
            </p>
          </div>
        )}

        {gameType === "shanghai" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>Mode</div>
            <div className="row">
              {[
                ["beginner", "Beginner (1-7)"],
                ["advanced", "Advanced (15-20+Bull)"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={`btn ${shanghaiMode === k ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setShanghaiMode(k)}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              7 rounds on sequential targets. Only darts hitting the round&apos;s target score.
              Hit single + double + triple of the target in one turn for an instant Shanghai win.
            </p>
          </div>
        )}

        {gameType === "halveit" && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            9 rounds with fixed targets (20, 19, 18, any double, 17, 16, 15, any triple, Bull).
            Start at 40. Miss all 3 darts and your score is halved. Highest score wins.
          </p>
        )}

        {gameType === "gotcha" && (
          <div className="mt-12">
            <div className="tag" style={{ marginBottom: 6 }}>Target Score</div>
            <div className="row">
              {[301, 501].map((v) => (
                <button
                  key={v}
                  className={`btn ${gotchaTarget === v ? "btn-toggle-on" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => setGotchaTarget(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
              Race to the target. Exceed it and you bust. Land on an opponent&apos;s exact score
              to reset them to 0.
            </p>
          </div>
        )}

        {gameType === "tictactoe" && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
            2-player only. A 3x3 grid of numbers (20 down to 12). Hit an unclaimed square to
            claim it; hit an opponent&apos;s square to cancel it. Three in a row wins.
          </p>
        )}
      </div>

      {botAllowed && (
        <div className="card mb-12 clickable setup-bot-card" {...pressProps(() => onOpenBots(gameType))}>
          <span className="setup-bot-stack" aria-hidden="true">
            {["bot:rook", "bot:jay", "bot:blackbird"].map((id) => (
              <BotAvatar key={id} bot={id} size={34} />
            ))}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>Play a Bot</div>
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
              Practice against eight opponents, from Rook to Blackbird. Never counts toward stats.
            </div>
          </div>
          <span className="setup-bot-go" aria-hidden="true">
            <ChevronIcon />
          </span>
        </div>
      )}

      <div className="card mb-12">
        <div className="tag mb-12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Players ({exactTwo ? "exactly 2" : needsTwo ? "2-4" : "1 = solo practice, up to 4"})</span>
          {selected.length >= 2 && (
            <button className="btn" onClick={shuffle} style={{ padding: "4px 10px", fontSize: "calc(11px * var(--fs))", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ShuffleIcon /> Shuffle
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {selected.length === 0 && <span className="subtle">No players selected yet.</span>}
          {selected.map((u, i) => (
            <div
              key={u}
              ref={(el) => { pillRefs.current[i] = el; }}
              draggable={selected.length >= 2}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              onTouchStart={(e) => onTouchStart(e, i)}
              onTouchMove={(e) => onTouchMove(e, i)}
              onTouchEnd={(e) => {
                const wasDrag = onTouchEnd(e);
                if (wasDrag) e.preventDefault();
              }}
              className="btn btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                cursor: selected.length >= 2 ? "grab" : "default",
                userSelect: "none",
                touchAction: selected.length >= 2 ? "none" : "auto",
              }}
            >
              {selected.length >= 2 && (
                <span style={{ opacity: 0.5, flex: "none", display: "flex" }}>
                  <DragIcon />
                </span>
              )}
              <span style={{ opacity: 0.6, fontSize: "calc(11px * var(--fs))", minWidth: 16, flex: "none" }}>{i + 1}.</span>
              <PlayerBadge username={u} color={playerColors?.[u]} size={20} showName={false} />
              <span style={{ flex: 1 }}>{u}{u === meName ? " (you)" : ""}</span>
              <button
                onClick={(e) => { e.stopPropagation(); remove(u); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: "2px 4px",
                  opacity: 0.7,
                  fontSize: "calc(14px * var(--fs))",
                  flex: "none",
                }}
                aria-label={`Remove ${u}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {selected.length >= 2 && (
          <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
            Drag to reorder. Player 1 throws first.
          </p>
        )}

        {rosterOptions.length > 0 && selected.length < (exactTwo ? 2 : 4) && (
          <select
            className="select mt-12"
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">+ Add a player…</option>
            {rosterOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
        {rosterOptions.length === 0 && selected.length < (exactTwo ? 2 : 4) && (
          <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>No other players available.</span>
            {onOpenFriends ? (
              <button type="button" className="btn btn-sm" onClick={onOpenFriends}>
                Follow players
              </button>
            ) : (
              <span>Follow players to pick them here.</span>
            )}
          </p>
        )}

        {(drill || (solo && !needsTwo)) && (
          <p className="tag" style={{ marginTop: 10, color: "var(--amber)", textTransform: "none", letterSpacing: 0 }}>
            {drill
              ? "Drill — saved to your practice log, never to stats or the leaderboard."
              : "Solo practice — saved to your practice log, not to stats or the leaderboard."}
          </p>
        )}
      </div>

      <button
        className="btn btn-primary"
        disabled={!canStart}
        style={{ width: "100%", fontSize: "calc(15px * var(--fs))", padding: 15 }}
        onClick={start}
      >
        {canStart ? (drill ? "Start Drill" : solo && !needsTwo ? "Start Practice" : "Start Game") : exactTwo ? "Pick exactly 2 players" : needsTwo ? "Pick at least 2 players" : "Pick at least 1 player"}
      </button>
    </div>
  );
}
