import { useState } from "react";
import { BASEBALL_INNINGS } from "@/lib/constants";

export default function PlayBaseball({ game, onFinish, onQuit }) {
  const { players } = game;
  const n = players.length;

  const blank = () => players.reduce((o, u) => ((o[u] = { innings: [], total: 0 }), o), {});
  const [state, setState] = useState(blank);
  const [turn, setTurn] = useState(0);
  const [history, setHistory] = useState([]);

  const cur = players[turn % n];
  const inning = Math.floor(turn / n) + 1;
  const isExtra = inning > BASEBALL_INNINGS;

  const submit = (runs) => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = {
      ...state,
      [cur]: {
        innings: [...state[cur].innings, runs],
        total: state[cur].total + runs,
      },
    };
    setState(ns);

    const newTurn = turn + 1;
    const completedInnings = Math.floor(newTurn / n);
    const roundComplete = newTurn % n === 0;

    if (roundComplete && completedInnings >= BASEBALL_INNINGS) {
      const max = Math.max(...players.map((u) => ns[u].total));
      const leaders = players.filter((u) => ns[u].total === max);
      if (leaders.length === 1 || n === 1) {
        const winner = leaders[0] || cur;
        const perPlayer = {};
        players.forEach((u) => (perPlayer[u] = { runs: ns[u].total }));
        onFinish({
          id: game.id,
          gameType: "baseball",
          config: {},
          players,
          winner,
          perPlayer,
          completedAt: new Date().toISOString(),
        });
        return;
      }
      // tie -> continue into extra innings
    }
    setTurn(newTurn);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setState(last.state);
      setTurn(last.turn);
      return h.slice(0, -1);
    });
  };

  const colCount = Math.max(inning, BASEBALL_INNINGS);
  const cols = Array.from({ length: colCount }, (_, i) => i + 1);

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: 17 }}>
          Baseball
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
                <td style={{ textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{u}</td>
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

      <div className="card">
        <div className="tag" style={{ marginBottom: 10 }}>
          Inning {isExtra ? `${inning} (extra)` : inning} — {cur}, runs scored this inning
        </div>
        <div className="grid-4">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => (
            <button
              key={r}
              className="chip"
              style={{ fontSize: 18, padding: "16px 0" }}
              onClick={() => submit(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="row mt-12">
          <button className="btn" style={{ width: "100%" }} onClick={undo} disabled={!history.length}>
            Undo last inning
          </button>
        </div>
      </div>
    </div>
  );
}
