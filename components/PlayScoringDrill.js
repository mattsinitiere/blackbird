import { useState, useEffect } from "react";
import DartBoard from "./DartBoard";
import { dartLabel } from "@/lib/darts";
import { PlayerBadge, UndoIcon } from "./ui";
import { createRecorder, ensureRecorder, stamp, recordVisit, recordEvent, finishRecorder, stripDarts } from "@/lib/recorder";
import { playerLabel } from "@/lib/bots";
import { scoringDartValue, scoringTargetLabel } from "@/lib/drills";

/**
 * Scoring drill: N visits at one number (or the bull). Only darts in that
 * number score. Highest total wins. Always a practice drill.
 */
export default function PlayScoringDrill({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players, config } = game;
  const n = players.length;
  const target = config.target || 20;
  const turns = config.turns || 10;
  const isBull = target === 25;

  const blank = () => {
    const st = players.reduce((o, u) => ((o[u] = { total: 0, visits: [], done: 0, onTarget: 0, trebles: 0, darts: 0, log: [] }), o), {});
    st.rec = createRecorder({ players, startedAt: game.startedAt });
    return st;
  };

  const [state, setState] = useState(() => ensureRecorder(resume?.state ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [history, setHistory] = useState(() => resume?.history ?? []);

  useEffect(() => {
    onProgress && onProgress({ state, turn, turnDarts, history });
  }, [state, turn, turnDarts, history, onProgress]);

  const cur = players[turn % n];
  const me = state[cur];
  const isDone = (s, u) => s[u].done >= turns;

  const finish = (ns) => {
    const completedAt = new Date().toISOString();
    const perPlayer = {};
    players.forEach((u) => {
      const p = ns[u];
      perPlayer[u] = {
        total: p.total,
        turns,
        avgPerTurn: p.done ? Math.round((p.total / p.done) * 10) / 10 : 0,
        trebles: p.trebles,
        onTarget: p.onTarget,
        hitRate: p.darts ? Math.round((p.onTarget / p.darts) * 100) : 0,
        bestVisit: p.visits.length ? Math.max(...p.visits) : 0,
        visitScores: p.visits, // per-visit points (stats v1 called this `visits`)
        dartsThrown: p.darts,
        darts: p.log,
        ...finishRecorder(ns.rec, u, completedAt),
      };
    });
    const winner = [...players].sort((a, b) => ns[b].total - ns[a].total)[0];
    onFinish({ id: game.id, gameType: "scoringDrill", config, players, winner, perPlayer, completedAt });
  };

  const commit = (darts) => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = JSON.parse(JSON.stringify(state));
    const p = ns[cur];
    const visit = darts.reduce((a, d) => a + scoringDartValue(target, d), 0);
    recordVisit(ns.rec, cur, { r: p.done, s0: p.total, darts, out: { s: visit } });
    p.total += visit;
    p.visits = [...p.visits, visit];
    p.done += 1;
    p.darts += darts.length;
    p.log = [...p.log, ...stripDarts(darts)];
    for (const d of darts) {
      if (d.n === target) {
        p.onTarget += 1;
        if (d.mult === 3) p.trebles += 1;
      }
    }
    setTurnDarts([]);

    if (players.every((u) => isDone(ns, u))) return finish(ns);
    let t = turn + 1;
    while (isDone(ns, players[t % n])) t++;
    setState(ns);
    setTurn(t);
  };

  const addDart = (mult) => {
    const dart = stamp(mult === 0 ? { n: 0, mult: 0 } : { n: target, mult }, game.startedAt);
    const next = [...turnDarts, dart];
    if (next.length === 3) return commit(next);
    setTurnDarts(next);
  };

  const undo = () => {
    if (turnDarts.length > 0) {
      setTurnDarts((d) => d.slice(0, -1));
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

  const visitSoFar = turnDarts.reduce((a, d) => a + scoringDartValue(target, d), 0);
  const label = scoringTargetLabel(target);

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>Scoring Drill · {label}</div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>Quit</button>
      </div>

      {!castActive && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, calc(120px * var(--fs))), 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {players.map((u) => {
            const p = state[u];
            const active = u === cur;
            return (
              <div
                key={u}
                className="card pad-sm"
                style={{
                  borderColor: active ? "var(--live)" : "var(--line)",
                  background: active ? "var(--live-soft)" : "var(--surface)",
                }}
              >
                <div className="between">
                  <PlayerBadge username={u} color={playerColors?.[u]} size={20} />
                  {active && <span className="tag" style={{ color: "var(--accent)" }}>at the oche</span>}
                </div>
                <div className="num" style={{ fontSize: "calc(32px * var(--fs))", lineHeight: 1.05, marginTop: 2 }}>
                  {p.total}{active && visitSoFar > 0 ? ` +${visitSoFar}` : ""}
                </div>
                <div className="tag" style={{ marginTop: 4 }}>
                  visit {Math.min(p.done + 1, turns)} of {turns} · {p.done ? (p.total / p.done).toFixed(1) : "0.0"} avg
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">
            {playerLabel(cur)} — visit {Math.min(me.done + 1, turns)} of {turns} · dart {Math.min(turnDarts.length + 1, 3)} of 3
          </span>
          {castActive && <span className="tag" style={{ color: "var(--accent)" }}>{me.total} + {visitSoFar}</span>}
        </div>

        <div className="flex-wrap" style={{ minHeight: 34, marginBottom: 8 }}>
          {turnDarts.length === 0 && <span className="tag">where did it land?</span>}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {d.n === 0 ? "Off" : dartLabel(d)}
            </span>
          ))}
        </div>

        <div className={isBull ? "grid-3" : "grid-4"} style={{ gap: 8, marginBottom: 12 }}>
          <button className="btn btn-primary" style={{ padding: 16 }} onClick={() => addDart(1)}>{isBull ? "25" : `S${target}`}</button>
          <button className="btn btn-primary" style={{ padding: 16 }} onClick={() => addDart(2)}>{isBull ? "Bull" : `D${target}`}</button>
          {!isBull && <button className="btn btn-primary" style={{ padding: 16 }} onClick={() => addDart(3)}>T{target}</button>}
          <button className="btn" style={{ padding: 16 }} onClick={() => addDart(0)}>Off</button>
        </div>
        <button className="chip chip-undo" onClick={undo} disabled={!turnDarts.length && !history.length}>
          <UndoIcon /> Undo
        </button>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard highlight={[target]} hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
