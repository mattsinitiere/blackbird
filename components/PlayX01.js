import { feedback } from "@/lib/feedback";
import { useState, useEffect, useCallback, useRef } from "react";
import { Modal, PlayerBadge, UndoIcon } from "./ui";
import DartBoard from "./DartBoard";
import Celebration from "./Celebration";
import { dartValue, dartLabel } from "@/lib/darts";
import { botFor, playerLabel } from "@/lib/bots";
import { pickX01Target, botThrow } from "@/lib/botStrategy";
import { ALTER_EGO_ID, botFromConfig, throwForAlterEgo } from "@/lib/alterEgo";
import { X01Hint } from "./StrategyHint";
import { useBotTurn } from "@/lib/useBotTurn";
import { createRecorder, ensureRecorder, stamp, recordVisit, finishRecorder, stripDarts } from "@/lib/recorder";
import { x01VisitOutcome, checkoutConfirmation } from "@/lib/x01log";
import { visitEntry, undoVisit } from "@/lib/visitUndo";
import { lastVisitToShow, describeX01Visit } from "@/lib/lastVisit";
import LastVisit from "./LastVisit";

export default function PlayX01({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors, hints = null, me = null }) {
  const { players, config } = game;
  const start = config.startScore;
  const legs = config.legs || 1;
  const isLegs = legs > 1;

  const blank = () => ({
    scores: players.reduce((o, u) => ((o[u] = start), o), {}),
    darts: players.reduce((o, u) => ((o[u] = 0), o), {}),
    points: players.reduce((o, u) => ((o[u] = 0), o), {}),
    highestTurn: players.reduce((o, u) => ((o[u] = 0), o), {}),
    checkout: players.reduce((o, u) => ((o[u] = 0), o), {}),
    log: players.reduce((o, u) => ((o[u] = []), o), {}),
    dartPos: players.reduce(
      (o, u) => ((o[u] = [{ sum: 0, count: 0 }, { sum: 0, count: 0 }, { sum: 0, count: 0 }]), o),
      {}
    ),
    // stats v2: every visit with its darts, and the legs already played
    rec: createRecorder({ players, startedAt: game.startedAt }),
    legs: players.reduce((o, u) => ((o[u] = []), o), {}),
  });

  const [s, setS] = useState(() => ensureRecorder(resume?.s ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [mult, setMult] = useState(() => resume?.mult ?? 1);
  const [msg, setMsg] = useState(() => resume?.msg ?? "");
  const [history, setHistory] = useState(() => resume?.history ?? []);
  const [celeb, setCeleb] = useState(null);
  const [legsWon, setLegsWon] = useState(() => resume?.legsWon ?? players.reduce((o, u) => ((o[u] = 0), o), {}));
  const [legHistory, setLegHistory] = useState(() => resume?.legHistory ?? []);
  // a finishing dart waits here until it's confirmed (or undone), so one
  // mis-tap can't hand out a leg or a ranked result: { darts, autoMs }
  const [pendingWin, setPendingWin] = useState(() => resume?.pendingWin ?? null);
  const doneRef = useRef(false); // set once onFinish fires; stops a trailing bot throw

  useEffect(() => {
    onProgress && onProgress({ s, turn, turnDarts, mult, msg, history, legsWon, legHistory, pendingWin });
  }, [s, turn, turnDarts, mult, msg, history, legsWon, legHistory, pendingWin, onProgress]);

  const cur = players[turn % players.length];
  const turnSum = turnDarts.reduce((a, d) => a + dartValue(d), 0);
  const remaining = s.scores[cur] - turnSum;

  const finishGame = useCallback((ns, winner) => {
    doneRef.current = true;
    const completedAt = new Date().toISOString();
    const perPlayer = {};
    players.forEach((u) => {
      // whole-match totals: the legs already played plus the final leg
      const prior = (ns.legs && ns.legs[u]) || [];
      const dartPos = [0, 1, 2].map((i) => ({
        sum: prior.reduce((a, l) => a + (l.dartPos?.[i]?.sum || 0), 0) + (ns.dartPos[u][i]?.sum || 0),
        count: prior.reduce((a, l) => a + (l.dartPos?.[i]?.count || 0), 0) + (ns.dartPos[u][i]?.count || 0),
      }));
      perPlayer[u] = {
        dartsThrown: prior.reduce((a, l) => a + l.d, 0) + ns.darts[u],
        pointsScored: prior.reduce((a, l) => a + (l.points || 0), 0) + ns.points[u],
        highestTurn: Math.max(ns.highestTurn[u], ...prior.map((l) => l.highestTurn || 0)),
        checkout: u === winner ? ns.checkout[u] : 0,
        finalScore: ns.scores[u],
        darts: [...prior.flatMap((l) => l.log || []), ...ns.log[u]],
        dartPos,
        legsWon: isLegs ? (legsWon[u] + (u === winner ? 1 : 0)) : undefined,
        legs: isLegs
          ? [...prior.map(({ w, d, co, s0 }) => ({ w, d, co, s0 })), { w: winner, d: ns.darts[u], co: u === winner ? ns.checkout[u] : 0, s0: start }]
          : undefined,
        ...finishRecorder(ns.rec, u, completedAt),
      };
    });
    onFinish({
      id: game.id,
      gameType: "x01",
      config,
      players,
      winner,
      perPlayer,
      completedAt,
    });
  }, [game, players, config, isLegs, legsWon, onFinish, start]);

  const commit = (darts, kind) => {
    setHistory((h) => [...h, { s: JSON.parse(JSON.stringify(s)), turn }]);
    const sum = darts.reduce((a, d) => a + dartValue(d), 0);
    const scoreBefore = s.scores[cur];
    const ns = JSON.parse(JSON.stringify(s));
    ns.darts[cur] += darts.length;
    ns.log[cur] = [...ns.log[cur], ...stripDarts(darts)];
    const counted = kind !== "bust";
    recordVisit(ns.rec, cur, {
      r: (ns.legs && ns.legs[cur] ? ns.legs[cur].length : 0),
      s0: scoreBefore,
      darts,
      out: { k: kind, s: counted ? sum : 0, rem: counted ? scoreBefore - sum : scoreBefore },
    });
    // the visit just thrown, for the "last visit" line after a bot's visit
    ns.last = { by: cur, darts: stripDarts(darts), k: kind, s: counted ? sum : 0, rem: counted ? scoreBefore - sum : scoreBefore };
    darts.forEach((d, i) => {
      if (i > 2) return;
      ns.dartPos[cur][i].count += 1;
      ns.dartPos[cur][i].sum += counted ? dartValue(d) : 0;
    });
    if (kind !== "bust") {
      ns.scores[cur] = scoreBefore - sum;
      ns.points[cur] += sum;
      ns.highestTurn[cur] = Math.max(ns.highestTurn[cur], sum);
    }
    setTurnDarts([]);
    setMult(1);

    if (sum === 180 && kind !== "bust") {
      setCeleb({ type: "180" });
    }

    if (kind === "win") {
      ns.checkout[cur] = scoreBefore;
      if (scoreBefore >= 100) {
        setCeleb({ type: "checkout", label: `${scoreBefore} checkout!` });
      }
      if (isLegs) {
        const newLegsWon = { ...legsWon, [cur]: legsWon[cur] + 1 };
        const needed = Math.ceil(legs / 2);
        if (newLegsWon[cur] >= needed) {
          setLegsWon(newLegsWon);
          finishGame(ns, cur);
          return;
        }
        setLegHistory(lh => [...lh, { winner: cur, darts: ns.darts[cur], checkout: scoreBefore }]);
        setLegsWon(newLegsWon);
        // keep the finished leg (per player) and the recorder; fresh scores
        const nb = blank();
        nb.rec = ns.rec;
        nb.last = ns.last;
        players.forEach((u) => {
          nb.legs[u] = [
            ...((ns.legs && ns.legs[u]) || []),
            { w: cur, d: ns.darts[u], co: u === cur ? scoreBefore : 0, s0: start, points: ns.points[u], highestTurn: ns.highestTurn[u], dartPos: ns.dartPos[u], log: ns.log[u] },
          ];
        });
        const legsPlayed = nb.legs[cur].length;
        setS(nb);
        // only the finishing visit stays undoable, so Undo can reopen the
        // leg: with its darts back minus the finishing one, the dart Undo
        // is meant to fix
        setHistory([{ ...visitEntry({ s, turn, darts }), legsWon, legHistory }]);
        // the throw alternates each leg
        setTurn(legsPlayed % players.length);
        setMsg(`${playerLabel(cur)} wins leg ${newLegsWon[cur]}!`);
        return;
      }
      finishGame(ns, cur);
      return;
    }
    setS(ns);
    setMsg(kind === "bust" ? "Bust — no score" : "");
    if (kind === "bust") feedback("bust");
    setTurn((t) => t + 1);
  };

  const addDart = (raw) => {
    if (pendingWin) return;
    const dart = stamp(raw, game.startedAt);
    const next = [...turnDarts, dart];
    const kind = x01VisitOutcome(s.scores[cur], next, !!config.doubleOut);
    if (kind === "win") {
      const hold = checkoutConfirmation({ isBot: !!bot, legsWon: legsWon[cur], legs });
      if (!hold.hold) return commit(next, "win");
      setTurnDarts(next);
      setMsg("");
      setPendingWin({ darts: next, autoMs: hold.autoMs });
      return;
    }
    if (kind) return commit(next, kind);
    setMsg("");
    setTurnDarts(next);
    setMult(1); // back to Single after every dart — a stuck Double/Triple is the easiest way to mis-score
  };

  const confirmWin = () => {
    if (!pendingWin) return;
    const darts = pendingWin.darts;
    setPendingWin(null);
    commit(darts, "win");
  };
  const confirmRef = useRef(confirmWin);
  confirmRef.current = confirmWin;
  // a leg that doesn't end the match counts by itself after a few seconds
  useEffect(() => {
    if (!pendingWin?.autoMs) return;
    const id = setTimeout(() => confirmRef.current(), pendingWin.autoMs);
    return () => clearTimeout(id);
  }, [pendingWin]);

  const undo = () => {
    if (pendingWin) {
      setPendingWin(null);
      setTurnDarts((d) => d.slice(0, -1));
      return;
    }
    if (turnDarts.length > 0) {
      setTurnDarts((d) => d.slice(0, -1));
      return;
    }
    const back = undoVisit(history);
    if (!back) return;
    const last = back.entry;
    setS(last.s);
    setTurn(last.turn);
    // a scored visit reopens empty; a leg's finishing visit reopens that
    // leg with its darts before the finishing one
    setTurnDarts(last.darts);
    setMult(1);
    if (last.legsWon) setLegsWon(last.legsWon);
    if (last.legHistory) setLegHistory(last.legHistory);
    setMsg("");
    setHistory(back.history);
  };

  // a bot at the oche throws by itself through addDart, one dart at a time
  // Alter Ego's profile was frozen into the game config when it started
  // (lib/alterEgo.js); it's never recomputed mid-game or on resume
  const bot = cur === ALTER_EGO_ID ? botFromConfig(config.alterEgo) : botFor(cur);
  useBotTurn({
    active: !!bot && !doneRef.current,
    key: `${turn}:${turnDarts.length}:${legHistory.length}`,
    throwOne: () => {
      const target = pickX01Target({ remaining, doubleOut: !!config.doubleOut, checkout: bot.checkout });
      const land = bot.id === ALTER_EGO_ID ? throwForAlterEgo(bot, target, remaining, !!config.doubleOut) : botThrow(bot, target);
      addDart({ n: land.n, mult: land.mult });
    },
  });
  const botLock = bot ? { opacity: 0.5, pointerEvents: "none" } : undefined;
  // a bot's visit stays readable until the person's first dart
  const lastShown = lastVisitToShow(s.last, { cur, thrown: turnDarts.length, botAtOche: !!bot, botsOnly: true });

  const avg = (u) => (s.darts[u] ? ((s.points[u] / s.darts[u]) * 3).toFixed(1) : "0.0");


  return (
    <div className="fade">
      {celeb && <Celebration type={celeb.type} label={celeb.label} onDone={() => setCeleb(null)} />}
      <div className="between mb-12">
        <div>
          <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
            {start} · {config.doubleOut ? "double out" : "straight out"}
          </div>
          {isLegs && (
            <div className="tag" style={{ marginTop: 2 }}>
              Best of {legs} — {players.map(u => `${playerLabel(u)} ${legsWon[u]}`).join(" · ")}
            </div>
          )}
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      {!castActive && (
      <div
        style={{
          display: "grid",
          // the column minimum follows the gentler chrome scale, and 3-4
          // players always get two columns, so the keypad stays on screen
          // at Huge text; the score shrinks to its card instead
          gridTemplateColumns:
            players.length >= 3
              ? "repeat(auto-fit, minmax(min(calc(50% - 5px), calc(120px * var(--fs-chrome))), 1fr))"
              : "repeat(auto-fit, minmax(min(100%, calc(120px * var(--fs-chrome))), 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {players.map((u) => {
          const active = u === cur;
          const shown = active ? remaining : s.scores[u];
          return (
            <div
              key={u}
              className="card pad-sm"
              style={{
                borderColor: active ? "var(--live)" : "var(--line)",
                background: active ? "var(--live-soft)" : "var(--surface)",
                containerType: "inline-size",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <div className="between">
                <PlayerBadge username={u} color={playerColors?.[u]} size={20} showTag={players.length < 3} />
                {active && <span className="tag" style={{ color: "var(--accent)" }}>at the oche</span>}
              </div>
              <div
                className="num"
                style={{ fontSize: "min(calc(44px * var(--fs)), 34cqi)", lineHeight: 1.05, marginTop: 2, color: shown <= 40 ? "var(--red)" : "var(--ink)" }}
              >
                {shown}
              </div>
              <div className="tag" style={{ marginTop: 4 }}>
                avg {avg(u)} · {s.darts[u]} darts
                {isLegs ? ` · legs ${legsWon[u]}` : ""}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {!bot && !doneRef.current && !pendingWin && turnDarts.length < 3 && (
        <div className="x01-hint">
          <X01Hint remaining={remaining} dartsLeft={3 - turnDarts.length} doubleOut={!!config.doubleOut} prefs={hints?.prefs} evidence={cur === me ? hints?.evidence : null} />
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">
            {playerLabel(cur)} — dart {Math.min(turnDarts.length + 1, 3)} of 3
            {castActive ? ` · ${remaining} left` : ""}
            {bot ? " · throwing…" : ""}
          </span>
          <span style={{ minHeight: 16, color: "var(--red)", fontSize: "calc(12px * var(--fs))", fontWeight: 600 }}>{msg}</span>
        </div>

        <div className="flex-wrap" style={{ minHeight: 34, marginBottom: 8, alignItems: "center" }}>
          {turnDarts.length === 0 &&
            (lastShown ? <LastVisit last={lastShown} outcome={describeX01Visit(lastShown)} inline /> : <span className="tag">tap a multiplier, then a number</span>)}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn x01-dart">
              {dartLabel(d)}
            </span>
          ))}
          {/* beside the darts, so it stays on screen above the keypad; while a
              checkout waits for its confirm, Undo lives in the confirm panel */}
          {!pendingWin && (
            <button className="chip chip-undo" style={{ width: "auto", margin: "0 0 0 auto", padding: "8px 14px" }} onClick={undo} disabled={!!bot || (!turnDarts.length && !history.length)}>
              <UndoIcon /> Undo
            </button>
          )}
        </div>

        {pendingWin && (
          <div className="x01-confirm" role="alertdialog" aria-label="Confirm checkout">
            <div className="x01-confirm-text">
              {playerLabel(cur)} checks out {s.scores[cur]} on {dartLabel(pendingWin.darts[pendingWin.darts.length - 1])}
            </div>
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>
              {pendingWin.autoMs ? "Counts in a few seconds. Wrong key? Undo the dart." : "Wrong key? Undo the dart. The result is saved once you confirm."}
            </div>
            {pendingWin.autoMs && (
              <div className="x01-confirm-timer" aria-hidden="true">
                <span style={{ animationDuration: `${pendingWin.autoMs}ms` }} />
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={undo}>
                <UndoIcon /> Undo dart
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmWin}>
                {isLegs && !checkoutConfirmation({ isBot: false, legsWon: legsWon[cur], legs }).winsMatch ? "Confirm leg" : "Confirm win"}
              </button>
            </div>
          </div>
        )}

        <div style={pendingWin ? { opacity: 0.35, pointerEvents: "none" } : botLock} aria-hidden={pendingWin ? true : undefined}>
        <div className="row mb-12">
          {[1, 2, 3].map((m) => (
            <button
              key={m}
              className={`btn ${mult === m ? "btn-primary" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setMult(m)}
            >
              {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
            </button>
          ))}
        </div>

        <div className="grid-5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <button key={n} className="chip" style={{ fontSize: "calc(15px * var(--fs))", padding: "12px 0" }} onClick={() => addDart({ n, mult })}>
              {n}
            </button>
          ))}
        </div>

        <div className="grid-3 mt-12">
          <button className="chip" onClick={() => addDart({ n: 25, mult: 1 })}>25</button>
          <button className="chip" onClick={() => addDart({ n: 25, mult: 2 })}>Bull</button>
          <button className="chip" onClick={() => addDart({ n: 0, mult: 0 })}>Miss</button>
        </div>
        </div>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
