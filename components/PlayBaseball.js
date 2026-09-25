import { useState, useEffect, useRef } from "react";
import { BASEBALL_INNINGS } from "@/lib/constants";
import DartBoard from "./DartBoard";
import { PlayerBadge, UndoIcon } from "./ui";
import { botFor, playerLabel } from "@/lib/bots";
import { pickBaseballTarget, botThrow } from "@/lib/botStrategy";
import { useBotTurn } from "@/lib/useBotTurn";
import { ALTER_EGO_ID, botFromConfig } from "@/lib/alterEgo";
import { createRecorder, ensureRecorder, stamp, recordVisit, finishRecorder, stripDarts } from "@/lib/recorder";

export default function PlayBaseball({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players } = game;
  const n = players.length;

  const blank = () => {
    const st = players.reduce((o, u) => ((o[u] = { innings: [], total: 0, log: [] }), o), {});
    st.rec = createRecorder({ players, startedAt: game.startedAt });
    return st;
  };
  const [state, setState] = useState(() => ensureRecorder(resume?.state ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [history, setHistory] = useState(() => resume?.history ?? []);
  const doneRef = useRef(false);

  useEffect(() => {
    onProgress && onProgress({ state, turn, turnDarts, history });
  }, [state, turn, turnDarts, history, onProgress]);

  const cur = players[turn % n];
  const inning = Math.floor(turn / n) + 1;
  const isExtra = inning > BASEBALL_INNINGS;
  // numbers continue 10,11,...20 then wrap back to 1
  const target = ((inning - 1) % 20) + 1;

  const addDart = (mult) => {
    if (turnDarts.length >= 3) return;
    // mult 0 = miss
    const dart = stamp(mult === 0 ? { n: 0, mult: 0 } : { n: target, mult }, game.startedAt);
    const next = [...turnDarts, dart];
    if (next.length === 3) commitInning(next);
    else setTurnDarts(next);
  };

  const commitInning = (darts) => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const runs = darts.reduce((a, d) => a + (d.n === target ? d.mult : 0), 0);
    const ns = JSON.parse(JSON.stringify(state));
    recordVisit(ns.rec, cur, { r: inning - 1, s0: ns[cur].total, darts, out: { runs } });
    ns[cur].innings = [...ns[cur].innings, runs];
    ns[cur].total += runs;
    ns[cur].log = [...ns[cur].log, ...stripDarts(darts)];
    setState(ns);
    setTurnDarts([]);

    const newTurn = turn + 1;
    const completedInnings = Math.floor(newTurn / n);
    if (newTurn % n === 0 && completedInnings >= BASEBALL_INNINGS) {
      const max = Math.max(...players.map((u) => ns[u].total));
      const leaders = players.filter((u) => ns[u].total === max);
      if (leaders.length === 1 || n === 1) {
        const winner = leaders[0] || cur;
        doneRef.current = true;
        const completedAt = new Date().toISOString();
        const perPlayer = {};
        players.forEach((u) => {
          perPlayer[u] = { runs: ns[u].total, innings: ns[u].innings, dartsThrown: ns[u].log.length, darts: ns[u].log, ...finishRecorder(ns.rec, u, completedAt) };
        });
        onFinish({
          id: game.id,
          gameType: "baseball",
          config: game.config?.alterEgo ? { alterEgo: game.config.alterEgo } : {},
          players,
          winner,
          perPlayer,
          completedAt,
        });
        return;
      }
    }
    setTurn(newTurn);
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

  // a bot at the oche aims the triple of the inning's number
  // the Alter Ego is rebuilt from the profile frozen into the game when it
  // started (lib/alterEgo.js); it's never recomputed mid-game or on resume
  const bot = cur === ALTER_EGO_ID ? botFromConfig(game.config?.alterEgo) : botFor(cur);
  useBotTurn({
    active: !!bot && !doneRef.current,
    key: `${turn}:${turnDarts.length}`,
    throwOne: () => {
      const land = botThrow(bot, pickBaseballTarget(target));
      addDart(land.n === target ? land.mult : 0);
    },
  });
  const botLock = bot ? { opacity: 0.5, pointerEvents: "none" } : undefined;

  const colCount = Math.max(inning, BASEBALL_INNINGS);
  const cols = Array.from({ length: colCount }, (_, i) => i + 1);
  const liveRuns = turnDarts.reduce((a, d) => a + (d.n === target ? d.mult : 0), 0);

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
          Baseball
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      {!castActive && (
      <div className="card pad-sm mb-12" style={{ overflowX: "auto" }}>
        <table className="cricket-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {cols.map((c) => (
                <th key={c} style={{ color: c === inning ? "var(--accent)" : undefined }}>
                  {c > BASEBALL_INNINGS ? "E" : c}
                </th>
              ))}
              <th>R</th>
            </tr>
          </thead>
          <tbody>
            {players.map((u) => (
              <tr key={u} className={u === cur ? "active" : ""}>
                <td style={{ textAlign: "left", whiteSpace: "nowrap" }}><PlayerBadge username={u} color={playerColors?.[u]} size={18} /></td>
                {cols.map((c) => (
                  <td key={c} className="num">
                    {state[u].innings[c - 1] != null ? state[u].innings[c - 1] : ""}
                  </td>
                ))}
                <td className="num" style={{ color: "var(--amber)" }}>
                  {state[u].total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 10 }}>
          <span className="tag">
            Inning {isExtra ? `${inning} (extra · ${target})` : inning} — {playerLabel(cur)}, dart {Math.min(turnDarts.length + 1, 3)} of 3{bot ? " · throwing…" : ""}
          </span>
          <span className="num" style={{ color: "var(--amber)" }}>{liveRuns}</span>
        </div>

        <div style={botLock}>
        <div className="grid-4">
          <button className="chip" onClick={() => addDart(1)}>Single</button>
          <button className="chip" onClick={() => addDart(2)}>Double</button>
          <button className="chip" onClick={() => addDart(3)}>Triple</button>
          <button className="chip" onClick={() => addDart(0)}>Miss</button>
        </div>

        <div className="flex-wrap" style={{ marginTop: 10, minHeight: 30 }}>
          {turnDarts.length === 0 && (
            <span className="tag">aim at {target} — log each dart</span>
          )}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {d.n === 0 ? "Miss" : d.mult === 1 ? "Single" : d.mult === 2 ? "Double" : "Triple"}
            </span>
          ))}
        </div>

        <button className="chip chip-undo" style={{ marginTop: 12 }} onClick={undo} disabled={!turnDarts.length && !history.length}>
          <UndoIcon /> Undo
        </button>
        </div>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard highlight={[target]} hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
