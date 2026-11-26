import { useState, useEffect, useRef } from "react";
import { CricketHint } from "./StrategyHint";
import { X01_TARGETS } from "@/lib/constants";
import { applyCricketVisit, blankCricketPlayer, canEndTurn, cricketClosedNotWinning, cricketWinner } from "@/lib/cricket";
import { markSymbol } from "@/lib/darts";
import DartBoard from "./DartBoard";
import Celebration from "./Celebration";
import { PlayerBadge, UndoIcon } from "./ui";
import { botFor, playerLabel } from "@/lib/bots";
import { pickCricketTarget, botThrow } from "@/lib/botStrategy";
import { useBotTurn } from "@/lib/useBotTurn";
import { lastVisitToShow, describeCricketVisit } from "@/lib/lastVisit";
import LastVisit from "./LastVisit";
import { ALTER_EGO_ID, botFromConfig } from "@/lib/alterEgo";
import { createRecorder, ensureRecorder, stamp, recordVisit, finishRecorder } from "@/lib/recorder";

const numOf = (t) => (t === "B" ? 25 : Number(t));

export default function PlayCricket({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors, hints = null }) {
  const { players } = game;
  const variant = game.config?.variant || "standard";

  const blank = () => {
    const st = players.reduce((o, u) => {
      o[u] = blankCricketPlayer();
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
    onFinish({
      id: game.id,
      gameType: "cricket",
      config: game.config?.alterEgo ? { variant, alterEgo: game.config.alterEgo } : { variant },
      players,
      winner,
      perPlayer,
      completedAt,
    });
  };

  const lastEndRef = useRef(0); // when the last turn ended, to drop a double tap on End turn

  const endTurn = () => {
    // a turn needs at least one dart (Miss counts), and a second tap right
    // after a turn ends is a double tap, not the next player's empty turn
    const now = Date.now();
    if (doneRef.current || !canEndTurn(darts.length, lastEndRef.current, now)) return;
    lastEndRef.current = now;
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = JSON.parse(JSON.stringify(state));
    const s0 = { m: { ...ns[cur].marks }, p: ns[cur].points };
    const { roundMarks, dead, recDarts } = applyCricketVisit(ns, cur, darts, { players, variant });
    recordVisit(ns.rec, cur, {
      r: Math.floor(turn / players.length),
      s0,
      darts: recDarts,
      out: { marks: roundMarks, pts: ns[cur].points - s0.p, dead },
    });
    // the visit just thrown, for the "last visit" line after a bot's visit
    // (Cutthroat points land on the others, so count everyone's)
    ns.lastVisit = {
      by: cur,
      darts: recDarts.map(({ n, mult }) => ({ n, mult })),
      marks: roundMarks,
      pts: players.reduce((a, o) => a + ns[o].points - state[o].points, 0),
    };
    setState(ns);
    setDarts([]);

    const winner = cricketWinner(ns, { players, variant, cur });
    if (winner) {
      setCeleb({ type: "close", label: "All closed!" });
      return finish(ns, winner);
    }
    setTurn((t) => t + 1);
  };

  const undo = () => {
    if (darts.length > 0) {
      setDarts((d) => d.slice(0, -1));
      return;
    }
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setState(last.state);
      setTurn(last.turn);
      return h.slice(0, -1);
    });
  };

  // a bot at the oche throws three darts (misses count) then ends its turn
  // the Alter Ego is rebuilt from the profile frozen into the game when it
  // started (lib/alterEgo.js); it's never recomputed mid-game or on resume
  const bot = cur === ALTER_EGO_ID ? botFromConfig(game.config?.alterEgo) : botFor(cur);
  useBotTurn({
    active: !!bot && !celeb && !doneRef.current,
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
  // a bot's visit stays readable until the person's first dart
  const lastShown = lastVisitToShow(state.lastVisit, { cur, thrown: darts.length, botAtOche: !!bot, botsOnly: true });

  const variantLabel =
    variant === "cutthroat" ? "Cutthroat" : variant === "noscore" ? "No-score" : "Score";

  // numbers the current player still needs to close
  const openTargets = X01_TARGETS.filter((t) => state[cur].marks[t] < 3).map(numOf);
  const boardHits = darts.filter((d) => d.target !== "M").map((d) => ({ n: numOf(d.target), mult: d.ring }));

  const liveMpr = (u) =>
    state[u].rounds ? (state[u].markCount / state[u].rounds).toFixed(2) : "—";
  const roundNo = Math.floor(turn / players.length) + 1;
  // closed every number but behind on points: the game goes on, say why
  const waiting = cricketClosedNotWinning(state, { players, variant });

  return (
    <div className="fade">
      {celeb && <Celebration type={celeb.type} label={celeb.label} onDone={() => setCeleb(null)} />}
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
      {waiting.length > 0 && (
        <div className="cricket-waiting mb-12" role="status">
          {waiting.map((u) => playerLabel(u)).join(" and ")} {waiting.length > 1 ? "have" : "has"} closed every number, but{" "}
          {variant === "cutthroat" ? `${waiting.length > 1 ? "aren't" : "isn't"} lowest on points` : `${waiting.length > 1 ? "don't" : "doesn't"} lead on points`}. Play on.
        </div>
      )}

      {!castActive && (
      <div className="card pad-sm mb-12" style={{ overflowX: "auto" }}>
        <table className="cricket-table cricket-board">
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
                <td className="cricket-who">
                  {/* avatar and name only: the tag pill pushed Bull, Pts and MPR off a phone screen */}
                  <PlayerBadge username={u} color={playerColors?.[u]} size={18} showName={false} />
                  <span className="cricket-name">{playerLabel(u)}</span>
                </td>
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
                  <td className="num" style={{ color: "var(--amber)" }}>
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
              style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}
              onClick={() => removeDart(i)}
            >
              {d.target === "M" ? "Miss" : `${d.ring === 1 ? "S" : d.ring === 2 ? "D" : "T"}${d.target}`} ✕
            </button>
          ))}
          {darts.length === 0 &&
            (lastShown ? (
              <LastVisit last={lastShown} outcome={describeCricketVisit({ ...lastShown, variant })} inline />
            ) : (
              <span className="tag">no darts yet (a dart off the numbers is a Miss)</span>
            ))}
        </div>

        <div className="row mt-12">
          <button className="chip chip-undo" style={{ flex: 1, width: "auto", marginTop: 0 }} onClick={undo} disabled={!darts.length && !history.length}>
            <UndoIcon /> Undo
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => endTurn()} disabled={!darts.length}>
            End turn
          </button>
        </div>
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
