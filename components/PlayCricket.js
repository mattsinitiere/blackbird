import { useState } from "react";
import { X01_TARGETS, CRICKET_VALUE } from "@/lib/constants";

export default function PlayCricket({ game, onFinish, onQuit }) {
  const { players } = game;

  const blank = () =>
    players.reduce((o, u) => {
      o[u] = {
        marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, B: 0 },
        points: 0,
        markCount: 0,
        rounds: 0,
      };
      return o;
    }, {});

  const [state, setState] = useState(blank);
  const [turn, setTurn] = useState(0);
  const [darts, setDarts] = useState([]);
  const [ring, setRing] = useState(1);
  const [history, setHistory] = useState([]);

  const cur = players[turn % players.length];

  const openForSomeone = (target, thrower, snap) =>
    players.some((u) => u !== thrower && (snap[u].marks[target] || 0) < 3);

  const addDart = (target) => {
    if (darts.length >= 3) return;
    const maxRing = target === "B" ? 2 : 3;
    setDarts((d) => [...d, { target, ring: Math.min(ring, maxRing) }]);
  };

  const removeDart = (i) => setDarts((d) => d.filter((_, idx) => idx !== i));

  const endTurn = () => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = JSON.parse(JSON.stringify(state));
    const me = ns[cur];

    for (const dt of darts) {
      const before = me.marks[dt.target];
      const after = before + dt.ring;
      me.marks[dt.target] = after;
      me.markCount += dt.ring;
      const scoringHits = Math.max(0, after - 3) - Math.max(0, before - 3);
      if (scoringHits > 0 && openForSomeone(dt.target, cur, ns)) {
        me.points += CRICKET_VALUE[dt.target] * scoringHits;
      }
    }
    me.rounds += 1;
    setState(ns);
    setDarts([]);

    const allClosed = X01_TARGETS.every((t) => ns[cur].marks[t] >= 3);
    const leadsOrTies = players.every((u) => u === cur || ns[cur].points >= ns[u].points);

    if (allClosed && leadsOrTies) {
      const perPlayer = {};
      players.forEach((u) => {
        perPlayer[u] = { marks: ns[u].markCount, rounds: ns[u].rounds, pointsScored: ns[u].points };
      });
      onFinish({
        id: game.id,
        gameType: "cricket",
        config: {},
        players,
        winner: cur,
        perPlayer,
        completedAt: new Date().toISOString(),
      });
      return;
    }
    setTurn((t) => t + 1);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setState(last.state);
      setTurn(last.turn);
      setDarts([]);
      return h.slice(0, -1);
    });
  };

  const markSymbol = (n) => (n <= 0 ? "" : n === 1 ? "/" : n === 2 ? "✕" : "⊗");

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: 17 }}>
          Cricket
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      <div className="card pad-sm mb-12" style={{ overflowX: "auto" }}>
        <table className="cricket-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {X01_TARGETS.map((t) => (
                <th key={t}>{t}</th>
              ))}
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {players.map((u) => (
              <tr key={u} className={u === cur ? "active" : ""}>
                <td style={{ textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{u}</td>
                {X01_TARGETS.map((t) => (
                  <td
                    key={t}
                    className="num"
                    style={{ color: state[u].marks[t] >= 3 ? "var(--accent)" : "var(--ink)" }}
                  >
                    {markSymbol(Math.min(state[u].marks[t], 3))}
                  </td>
                ))}
                <td className="num" style={{ color: "var(--amber)" }}>
                  {state[u].points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="tag" style={{ marginBottom: 10 }}>
          {cur} — tap ring, then target
        </div>
        <div className="row mb-12">
          {[1, 2, 3].map((rr) => (
            <button
              key={rr}
              className={`btn ${ring === rr ? "btn-amber" : ""}`}
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
              style={{ fontSize: 16, padding: "15px 0", opacity: darts.length >= 3 ? 0.4 : 1 }}
              onClick={() => addDart(t)}
            >
              {t === "B" ? "Bull" : t}
            </button>
          ))}
        </div>

        <div className="flex-wrap" style={{ marginTop: 10, minHeight: 30 }}>
          {darts.map((d, i) => (
            <button
              key={i}
              className="btn"
              style={{ padding: "5px 10px", fontSize: 13 }}
              onClick={() => removeDart(i)}
            >
              {d.ring === 1 ? "S" : d.ring === 2 ? "D" : "T"}
              {d.target} ✕
            </button>
          ))}
          {darts.length === 0 && <span className="tag">no darts entered yet</span>}
        </div>

        <div className="row mt-12">
          <button className="btn" style={{ flex: 1 }} onClick={undo} disabled={!history.length}>
            Undo turn
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={endTurn}>
            End turn
          </button>
        </div>
      </div>
    </div>
  );
}
