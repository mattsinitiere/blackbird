import { useState } from "react";
import { Modal } from "./ui";
import { QUICK_SCORES } from "@/lib/constants";

export default function PlayX01({ game, onFinish, onQuit }) {
  const { players, config } = game;
  const start = config.startScore;

  const blank = () =>
    players.reduce((o, u) => {
      o[u] = { score: start, darts: 0, points: 0, highestTurn: 0, checkout: 0 };
      return o;
    }, {});

  const [state, setState] = useState(blank);
  const [turn, setTurn] = useState(0);
  const [entry, setEntry] = useState("");
  const [history, setHistory] = useState([]);
  const [finishAsk, setFinishAsk] = useState(null);
  const [msg, setMsg] = useState("");

  const cur = players[turn % players.length];

  const snapshot = () =>
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);

  const submit = () => {
    const val = parseInt(entry || "0", 10);
    if (isNaN(val) || val < 0 || val > 180) {
      setMsg("Enter 0–180");
      return;
    }
    const remaining = state[cur].score;
    const next = remaining - val;
    let bust = false;
    let win = false;
    if (next < 0) bust = true;
    else if (next === 0) win = true;
    else if (config.doubleOut && next === 1) bust = true;

    if (win) {
      setFinishAsk({ player: cur, entry: val });
      return;
    }

    snapshot();
    setState((s) => {
      const ns = { ...s, [cur]: { ...s[cur] } };
      ns[cur].darts += 3;
      if (!bust) {
        ns[cur].score = next;
        ns[cur].points += val;
        ns[cur].highestTurn = Math.max(ns[cur].highestTurn, val);
      }
      return ns;
    });
    setMsg(bust ? "Bust — no score" : "");
    setEntry("");
    setTurn((t) => t + 1);
  };

  const confirmFinish = (dartsUsed) => {
    const { player, entry: val } = finishAsk;
    const finalState = { ...state, [player]: { ...state[player] } };
    finalState[player].score = 0;
    finalState[player].darts += dartsUsed;
    finalState[player].points += val;
    finalState[player].highestTurn = Math.max(finalState[player].highestTurn, val);
    finalState[player].checkout = val;
    setFinishAsk(null);

    const perPlayer = {};
    players.forEach((u) => {
      const p = finalState[u];
      perPlayer[u] = {
        dartsThrown: p.darts,
        pointsScored: p.points,
        highestTurn: p.highestTurn,
        checkout: u === player ? val : 0,
        finalScore: p.score,
      };
    });

    onFinish({
      id: game.id,
      gameType: "x01",
      config,
      players,
      winner: player,
      perPlayer,
      completedAt: new Date().toISOString(),
    });
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setState(last.state);
      setTurn(last.turn);
      setMsg("");
      setEntry("");
      return h.slice(0, -1);
    });
  };

  const keypad = (k) => {
    if (k === "C") setEntry("");
    else if (k === "←") setEntry((e) => e.slice(0, -1));
    else setEntry((e) => (e.length >= 3 ? e : e === "0" ? k : e + k));
  };

  const avg = (p) => (p.darts ? ((p.points / p.darts) * 3).toFixed(1) : "0.0");
  const cols = Math.min(players.length, 2);

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: 17 }}>
          {start} · {config.doubleOut ? "double out" : "straight out"}
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10, marginBottom: 12 }}
      >
        {players.map((u) => {
          const p = state[u];
          const active = u === cur;
          return (
            <div
              key={u}
              className="card pad-sm"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <div className="between">
                <span style={{ fontWeight: 700 }}>{u}</span>
                {active && (
                  <span className="tag" style={{ color: "var(--accent)" }}>
                    at the oche
                  </span>
                )}
              </div>
              <div
                className="num pop"
                key={p.score}
                style={{ fontSize: 46, lineHeight: 1.05, marginTop: 2, color: p.score <= 40 ? "var(--red)" : "var(--ink)" }}
              >
                {p.score}
              </div>
              <div className="tag" style={{ marginTop: 4 }}>
                avg {avg(p)} · {p.darts} darts
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">{cur} — enter 3-dart total</span>
          <span style={{ minHeight: 16, color: "var(--red)", fontSize: 12, fontWeight: 600 }}>{msg}</span>
        </div>

        <div
          className="num"
          style={{
            fontSize: 40,
            textAlign: "center",
            minHeight: 50,
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {entry || "0"}
        </div>

        <div className="grid-4 mt-12">
          {QUICK_SCORES.map((q) => (
            <button key={q} className="chip" style={{ fontSize: 15 }} onClick={() => setEntry(String(q))}>
              {q}
            </button>
          ))}
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "←"].map((k) => (
            <button key={k} className="chip" onClick={() => keypad(k)}>
              {k}
            </button>
          ))}
        </div>

        <div className="row mt-12">
          <button className="btn" style={{ flex: 1 }} onClick={undo} disabled={!history.length}>
            Undo
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={submit}>
            Enter
          </button>
        </div>
      </div>

      {finishAsk && (
        <Modal>
          <div className="display" style={{ fontSize: 19, marginBottom: 6 }}>
            Checkout!
          </div>
          <p className="subtle" style={{ marginTop: 0, marginBottom: 16 }}>
            {finishAsk.player} finished on {finishAsk.entry}. How many darts did the checkout take? (keeps the average honest)
          </p>
          <div className="row">
            {[1, 2, 3].map((d) => (
              <button key={d} className="btn btn-amber" style={{ flex: 1, fontSize: 18 }} onClick={() => confirmFinish(d)}>
                {d}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
