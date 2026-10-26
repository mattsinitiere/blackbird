import { useState, useEffect, useRef } from "react";
import { CricketHint } from "./StrategyHint";
import { X01_TARGETS, CRICKET_VALUE } from "@/lib/constants";
import { markSymbol } from "@/lib/darts";
import DartBoard from "./DartBoard";
import Celebration from "./Celebration";
import { PlayerBadge, UndoIcon } from "./ui";
import { botFor, playerLabel, isBot } from "@/lib/bots";
import { undoDepth, dartsAfterUndo } from "@/lib/undo";
import { useFinishConfirm } from "./FinishConfirm";
import { pickCricketTarget, botThrow } from "@/lib/botStrategy";
import { useBotTurn } from "@/lib/useBotTurn";
import { ALTER_EGO_ID, botFromConfig } from "@/lib/alterEgo";
import { createRecorder, ensureRecorder, stamp, recordVisit, finishRecorder } from "@/lib/recorder";
import { cutthroatWinner } from "@/packages/scoring-core/cricket.js";

const numOf = (t) => (t === "B" ? 25 : Number(t));

export default function PlayCricket({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors, hints = null }) {
  const { players } = game;
  const variant = game.config?.variant || "standard";

  const blank = () => {
    const st = players.reduce((o, u) => {
      o[u] = {
        marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, B: 0 },
        points: 0,
        markCount: 0,
        rounds: 0,
        roundMarks: [],
        log: [],
      };
      return o;
    }, {});
    st.rec = createRecorder({ players, startedAt: game.startedAt });
    return st;
  };

  const [state, setState] = useState(() => ensureRecorder(resume?.state ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [darts, setDarts] = useState(() => resume?.darts ?? []);
  const [ring, setRing] = useState(() => resume?.ring ?? 1);
  const [history, setHistory] = useState(() => resume?.history ?? []);
  const [celeb, setCeleb] = useState(null);
  const [botThrows, setBotThrows] = useState(0); // darts the bot has thrown this visit, misses included
  const doneRef = useRef(false);

  useEffect(() => {
    onProgress && onProgress({ state, turn, darts, ring, history });
  }, [state, turn, darts, ring, history, onProgress]);

  const cur = players[turn % players.length];
  const allClosed = (marks) => X01_TARGETS.every((t) => marks[t] >= 3);

  // target "M" is a miss (off 20–15 and bull); `land` is a bot's real landing
  const addDart = (target, ringOverride, land) => {
    if (darts.length >= 3) return;
    const maxRing = target === "B" ? 2 : 3;
    const r = target === "M" ? 0 : Math.min(ringOverride || ring, maxRing);
    const dart = stamp({ target, ring: r, land }, game.startedAt);
    setDarts((d) => [...d, dart]);
    setRing(1); // back to Single after every dart
  };
  const removeDart = (i) => setDarts((d) => d.filter((_, idx) => idx !== i));

  // the game-winning turn waits for one tap before the result saves
  const { finish: confirmFinish, confirmBar, confirming } = useFinishConfirm({
    onFinish,
    onUndo: () => {
      doneRef.current = false;
      undo();
    },
  });

  const finish = (ns, winner) => {
    doneRef.current = true;
    const completedAt = new Date().toISOString();
    const perPlayer = {};
    players.forEach((u) => {
      perPlayer[u] = {
        marks: ns[u].markCount,
        rounds: ns[u].rounds,
        roundMarks: ns[u].roundMarks || [],
        mpr: ns[u].rounds ? Math.round((ns[u].markCount / ns[u].rounds) * 100) / 100 : 0,
        pointsScored: ns[u].points,
        dartsThrown: ns[u].log.length,
        darts: ns[u].log,
        ...finishRecorder(ns.rec, u, completedAt),
      };
    });
    confirmFinish({
      id: game.id,
      gameType: "cricket",
      config: game.config?.alterEgo ? { variant, alterEgo: game.config.alterEgo } : { variant },
      players,
      winner,
      perPlayer,
      completedAt,
    });
  };

  const endTurn = () => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn, darts }]);
    const ns = JSON.parse(JSON.stringify(state));
    const me = ns[cur];

    if (!me.roundMarks) me.roundMarks = []; // resumed games saved before per-round tracking
    let roundMarks = 0;
    let dead = 0;
    const s0 = { m: { ...me.marks }, p: me.points };
    const recDarts = [];

    for (const dt of darts) {
      if (dt.target === "M") {
        // a miss: the real landing when a bot threw it, else unknown (0/0)
        const land = dt.land ? { n: dt.land.n, mult: dt.land.mult } : { n: 0, mult: 0 };
        me.log.push(land);
        recDarts.push({ ...land, t: dt.t, x: { m: 0 } });
        continue;
      }
      const before = me.marks[dt.target];
      const after = before + dt.ring;
      const anyOpen = players.some((o) => o !== cur && ns[o].marks[dt.target] < 3);
      me.marks[dt.target] = after;
      me.log.push({ n: numOf(dt.target), mult: dt.ring });
      // Standard MPR: hits that advance your close always count; extra hits
      // count only when they can score (an opponent still has the number open).
      // Dead darts (everyone closed / no-score variant surplus) count 0.
      const closingHits = Math.min(after, 3) - Math.min(before, 3);
      const scoringHits = Math.max(0, after - 3) - Math.max(0, before - 3);
      const liveScoring = variant !== "noscore" && anyOpen ? scoringHits : 0;
      me.markCount += closingHits + liveScoring;
      roundMarks += closingHits + liveScoring;
      dead += dt.ring - (closingHits + liveScoring);
      recDarts.push({ n: numOf(dt.target), mult: dt.ring, t: dt.t, x: { m: closingHits + liveScoring } });
      if (scoringHits > 0) {
        const value = CRICKET_VALUE[dt.target] * scoringHits;
        if (variant === "noscore") {
          // no points
        } else if (variant === "cutthroat") {
          players.forEach((o) => {
            if (o !== cur && ns[o].marks[dt.target] < 3) ns[o].points += value;
          });
        } else {
          if (anyOpen) me.points += value;
        }
      }
    }
    me.rounds += 1;
    me.roundMarks.push(roundMarks);
    recordVisit(ns.rec, cur, {
      r: Math.floor(turn / players.length),
      s0,
      darts: recDarts,
      out: { marks: roundMarks, pts: me.points - s0.p, dead },
    });
    setState(ns);
    setDarts([]);

    if (variant === "noscore") {
      if (allClosed(ns[cur].marks)) {
        setCeleb({ type: "close", label: "All closed!" });
        return finish(ns, cur);
      }
    } else if (variant === "cutthroat") {
      const winner = cutthroatWinner(players, ns, cur);
      if (winner) {
        setCeleb({ type: "close", label: "All closed!" });
        return finish(ns, winner);
      }
    } else {
      const closedAll = allClosed(ns[cur].marks);
      const leads = players.every((u) => u === cur || ns[cur].points >= ns[u].points);
      if (closedAll && leads) {
        setCeleb({ type: "close", label: "All closed!" });
        return finish(ns, cur);
      }
    }
    setTurn((t) => t + 1);
  };

  const undo = () => {
    if (darts.length > 0 && !isBot(cur)) {
      setDarts((d) => d.slice(0, -1));
      return;
    }
    // back to the last turn a person threw (a bot's turn is never re-rolled)
    const depth = undoDepth(history, players, isBot);
    setBotThrows(0);
    if (!depth) {
      if (darts.length) setDarts([]);
      return;
    }
    const back = history[history.length - depth];
    setState(back.state);
    setTurn(back.turn);
    setDarts(dartsAfterUndo(back.darts));
    setRing(1);
    setHistory(history.slice(0, -depth));
  };
  const canUndo = (darts.length > 0 && !isBot(cur)) || undoDepth(history, players, isBot) > 0;

  // a bot at the oche throws three darts (misses count) then ends its turn
  // the Alter Ego is rebuilt from the profile frozen into the game when it
  // started (lib/alterEgo.js); it's never recomputed mid-game or on resume
  const bot = cur === ALTER_EGO_ID ? botFromConfig(game.config?.alterEgo) : botFor(cur);
  useBotTurn({
    active: !!bot && !celeb && !doneRef.current && !confirming,
    key: `${turn}:${botThrows}`,
    throwOne: () => {
      if (botThrows >= 3) {
        setBotThrows(0);
        endTurn();
        return;
      }
      const target =
        pickCricketTarget({ variant, marks: state[cur].marks, others: players.filter((o) => o !== cur).map((o) => state[o].marks) }) ||
        { n: 20, mult: 3 };
      const land = botThrow(bot, target);
      const t = land.n === 25 ? "B" : String(land.n);
      // off-target landings are recorded as misses with their real position
      addDart(X01_TARGETS.includes(t) ? t : "M", land.mult, land);
      setBotThrows((b) => b + 1);
    },
  });
  const botLock = bot ? { opacity: 0.5, pointerEvents: "none" } : undefined;

  const variantLabel =
    variant === "cutthroat" ? "Cutthroat" : variant === "noscore" ? "No-score" : "Score";

  // numbers the current player still needs to close
  const openTargets = X01_TARGETS.filter((t) => state[cur].marks[t] < 3).map(numOf);
  const boardHits = darts.filter((d) => d.target !== "M").map((d) => ({ n: numOf(d.target), mult: d.ring }));

  const liveMpr = (u) =>
    state[u].rounds ? (state[u].markCount / state[u].rounds).toFixed(2) : "—";
  const roundNo = Math.floor(turn / players.length) + 1;

  return (
    <div className="fade">
      {celeb && <Celebration type={celeb.type} label={celeb.label} onDone={() => setCeleb(null)} />}
      {confirmBar}
      <div className="sr-only" aria-live="polite">
        {`${playerLabel(cur)} to throw, ${darts.length} of 3 darts entered.`}
      </div>
      <div className="between mb-12">
        <div>
          <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
            Cricket · {variantLabel}
          </div>
          <div className="tag" style={{ marginTop: 2 }}>Round {roundNo}</div>
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      {!bot && <CricketHint variant={variant} me={cur} players={players} state={state} prefs={hints?.prefs} />}
      {!castActive && (
      <div className="card pad-sm mb-12" style={{ overflowX: "auto" }}>
        <table className="cricket-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {X01_TARGETS.map((t) => (
                <th key={t}>{t}</th>
              ))}
              {variant !== "noscore" && <th>Pts</th>}
              <th>MPR</th>
            </tr>
          </thead>
          <tbody>
            {players.map((u) => (
              <tr key={u} className={u === cur ? "active" : ""}>
                <td style={{ textAlign: "left", whiteSpace: "nowrap" }}><PlayerBadge username={u} color={playerColors?.[u]} size={18} /></td>
                {X01_TARGETS.map((t) => (
                  <td
                    key={t}
                    className="num"
                    style={{ color: state[u].marks[t] >= 3 ? "var(--accent)" : "var(--ink)" }}
                  >
                    {markSymbol(Math.min(state[u].marks[t], 3))}
                  </td>
                ))}
                {variant !== "noscore" && (
                  <td className="num" style={{ color: "var(--ink)", fontWeight: 700 }}>
                    {state[u].points}
                  </td>
                )}
                <td className="num" style={{ color: "var(--muted)" }}>{liveMpr(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <div className="card">
        <div className="tag" style={{ marginBottom: 10 }}>
          {playerLabel(cur)} — {bot ? `throwing… dart ${Math.min(botThrows + 1, 3)} of 3` : "tap ring, then target"}
        </div>
        <div style={botLock}>
        <div className="row mb-12">
          {[1, 2, 3].map((rr) => (
            <button
              key={rr}
              className={`btn ${ring === rr ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              aria-pressed={ring === rr}
              onClick={() => setRing(rr)}
            >
              {rr === 1 ? "Single" : rr === 2 ? "Double" : "Triple"}
            </button>
          ))}
        </div>

        <div className="grid-4">
          {X01_TARGETS.map((t) => (
            <button
              key={t}
              className="chip"
              style={{ fontSize: "calc(16px * var(--fs))", padding: "15px 0", opacity: darts.length >= 3 ? 0.4 : 1 }}
              onClick={() => addDart(t)}
            >
              {t === "B" ? "Bull" : t}
            </button>
          ))}
          <button
            className="chip"
            style={{ fontSize: "calc(16px * var(--fs))", padding: "15px 0", opacity: darts.length >= 3 ? 0.4 : 1 }}
            onClick={() => addDart("M")}
            aria-label="Miss"
          >
            Miss
          </button>
        </div>

        <div className="flex-wrap" style={{ marginTop: 10, minHeight: 30 }}>
          {darts.map((d, i) => (
            <button
              key={i}
              className="btn"
              style={{ padding: "10px 14px", fontSize: "calc(14px * var(--fs))", minHeight: 44 }}
              onClick={() => removeDart(i)}
              aria-label={`Remove ${d.target === "M" ? "miss" : `${d.ring === 1 ? "single" : d.ring === 2 ? "double" : "triple"} ${d.target === "B" ? "bull" : d.target}`}`}
            >
              {d.target === "M" ? "Miss" : `${d.ring === 1 ? "S" : d.ring === 2 ? "D" : "T"}${d.target}`} ✕
            </button>
          ))}
          {darts.length === 0 && <span className="tag">no darts entered yet</span>}
        </div>

        </div>
        {/* undo sits outside the bot lock: it goes back past a bot's turn to yours */}
        <div className="row mt-12">
          <button className="chip chip-undo" style={{ flex: 1, width: "auto", marginTop: 0 }} onClick={undo} disabled={!canUndo}>
            <UndoIcon /> Undo
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={endTurn} disabled={!!bot}>
            End turn
          </button>
        </div>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard highlight={openTargets} hits={boardHits} />
          </div>
        )}
      </div>
    </div>
  );
}
