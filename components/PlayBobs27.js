import { useState, useEffect } from "react";
import DartBoard from "./DartBoard";
import { PlayerBadge, UndoIcon } from "./ui";
import { createRecorder, ensureRecorder, stamp, recordVisit, recordEvent, finishRecorder, stripDarts } from "@/lib/recorder";
import { playerLabel } from "@/lib/bots";
import { BOBS27_START, BOBS27_ROUNDS, bobsTarget, isBobsHit, bobsRoundScore } from "@/lib/drills";

/**
 * Bob's 27: start on 27, three darts at D1, then D2 … D20, then the
 * double bull. Each double hit adds twice the number; missing all three
 * takes it away. Drop to 0 or below and you're out. Highest score at the
 * end wins. Always a practice drill (lib/practice.js).
 */
export default function PlayBobs27({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players, config } = game;
  const n = players.length;

  const blank = () => {
    const st = players.reduce((o, u) => ((o[u] = { score: BOBS27_START, round: 1, hits: 0, busted: false, darts: 0, log: [] }), o), {});
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
  const target = bobsTarget(me.round);
  const done = (u) => state[u].busted || state[u].round > BOBS27_ROUNDS;

  const finish = (ns) => {
    const completedAt = new Date().toISOString();
    const perPlayer = {};
    players.forEach((u) => {
      perPlayer[u] = {
        finalScore: ns[u].score,
        doublesHit: ns[u].hits,
        roundsCompleted: Math.min(ns[u].round - 1, BOBS27_ROUNDS),
        busted: ns[u].busted,
        dartsThrown: ns[u].darts,
        darts: ns[u].log,
        ...finishRecorder(ns.rec, u, completedAt),
      };
    });
    // highest score wins; a busted player never beats a standing one
    const rank = (u) => (ns[u].busted ? -1e6 : 0) + ns[u].score;
    const winner = [...players].sort((a, b) => rank(b) - rank(a))[0];
    onFinish({ id: game.id, gameType: "bobs27", config, players, winner, perPlayer, completedAt });
  };

  const commit = (darts) => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = JSON.parse(JSON.stringify(state));
    const p = ns[cur];
    const { hits, delta } = bobsRoundScore(p.round, darts);
    const s0 = p.score;
    p.score += delta;
    p.hits += hits;
    p.darts += darts.length;
    p.log = [...p.log, ...stripDarts(darts)];
    if (p.score <= 0) {
      p.score = 0;
      p.busted = true;
    }
    recordVisit(ns.rec, cur, { r: p.round - 1, s0, darts, out: { hits, delta, sc: p.score } });
    p.round += 1;
    setTurnDarts([]);

    const isDone = (u) => ns[u].busted || ns[u].round > BOBS27_ROUNDS;
    if (players.every(isDone)) return finish(ns);
    let t = turn + 1;
    while (isDone(players[t % n])) t++;
    setState(ns);
    setTurn(t);
  };

  const addDart = (raw) => {
    const next = [...turnDarts, stamp(raw, game.startedAt)];
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

  const turnHits = turnDarts.filter((d) => isBobsHit(me.round, d)).length;

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>Bob&apos;s 27</div>
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
                  opacity: p.busted ? 0.6 : 1,
                }}
              >
                <div className="between">
                  <PlayerBadge username={u} color={playerColors?.[u]} size={20} />
                  {active && <span className="tag" style={{ color: "var(--accent)" }}>at the oche</span>}
                </div>
                <div className="num" style={{ fontSize: "calc(32px * var(--fs))", lineHeight: 1.05, marginTop: 2 }}>{p.score}</div>
                <div className="tag" style={{ marginTop: 4 }}>
                  {p.busted ? "out" : done(u) ? "finished" : `next ${bobsTarget(p.round).label}`} · {p.hits} doubles
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">
            {playerLabel(cur)} — round {me.round} of {BOBS27_ROUNDS} · dart {Math.min(turnDarts.length + 1, 3)} of 3
          </span>
          <span className="tag" style={{ color: "var(--accent)" }}>{castActive ? `${me.score} · ` : ""}aim {target.label}</span>
        </div>

        <div className="flex-wrap" style={{ minHeight: 34, marginBottom: 8 }}>
          {turnDarts.length === 0 && <span className="tag">hit or miss, three darts</span>}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {isBobsHit(me.round, d) ? target.label : "Miss"}
            </span>
          ))}
          {turnDarts.length > 0 && (
            <span className="tag" style={{ alignSelf: "center" }}>
              {turnHits > 0 ? `+${turnHits * target.value}` : `−${target.value} if all miss`}
            </span>
          )}
        </div>

        <div className="row mb-12">
          <button className="btn btn-primary" style={{ flex: 1, padding: 16, fontSize: "calc(16px * var(--fs))" }} onClick={() => addDart({ n: target.n, mult: 2 })}>
            Hit {target.label}
          </button>
          <button className="btn" style={{ flex: 1, padding: 16, fontSize: "calc(16px * var(--fs))" }} onClick={() => addDart({ n: 0, mult: 0 })}>
            Miss
          </button>
        </div>
        <button className="chip chip-undo" onClick={undo} disabled={!turnDarts.length && !history.length}>
          <UndoIcon /> Undo
        </button>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard highlight={[target.n]} hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
