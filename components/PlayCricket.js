import { useState, useEffect } from "react";
import { X01_TARGETS, CRICKET_VALUE } from "@/lib/constants";
import DartBoard from "./DartBoard";

const numOf = (t) => (t === "B" ? 25 : Number(t));

export default function PlayCricket({ game, resume, onProgress, onFinish, onQuit }) {
  const { players } = game;
  const variant = game.config?.variant || "standard";

  const blank = () =>
    players.reduce((o, u) => {
      o[u] = {
        marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, B: 0 },
        points: 0,
        markCount: 0,
        rounds: 0,
        log: [],
      };
      return o;
    }, {});

  const [state, setState] = useState(() => resume?.state ?? blank());
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [darts, setDarts] = useState(() => resume?.darts ?? []);
  const [ring, setRing] = useState(() => resume?.ring ?? 1);
  const [history, setHistory] = useState(() => resume?.history ?? []);

  useEffect(() => {
    onProgress && onProgress({ state, turn, darts, ring, history });
  }, [state, turn, darts, ring, history, onProgress]);

  const cur = players[turn % players.length];
  const allClosed = (marks) => X01_TARGETS.every((t) => marks[t] >= 3);

  const addDart = (target) => {
    if (darts.length >= 3) return;
    const maxRing = target === "B" ? 2 : 3;
    setDarts((d) => [...d, { target, ring: Math.min(ring, maxRing) }]);
  };
  const removeDart = (i) => setDarts((d) => d.filter((_, idx) => idx !== i));

  const finish = (ns, winner) => {
    const perPlayer = {};
    players.forEach((u) => {
      perPlayer[u] = {
        marks: ns[u].markCount,
        rounds: ns[u].rounds,
        pointsScored: ns[u].points,
        darts: ns[u].log,
      };
    });
    onFinish({
      id: game.id,
      gameType: "cricket",
      config: { variant },
      players,
      winner,
      perPlayer,
      completedAt: new Date().toISOString(),
    });
  };

  const endTurn = () => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn }]);
    const ns = JSON.parse(JSON.stringify(state));
    const me = ns[cur];

    for (const dt of darts) {
      const before = me.marks[dt.target];
      const after = before + dt.ring;
      me.marks[dt.target] = after;
      me.markCount += dt.ring;
      me.log.push({ n: numOf(dt.target), mult: dt.ring });
      const scoringHits = Math.max(0, after - 3) - Math.max(0, before - 3);
      if (scoringHits > 0) {
        const value = CRICKET_VALUE[dt.target] * scoringHits;
        if (variant === "noscore") {
          // no points
        } else if (variant === "cutthroat") {
          players.forEach((o) => {
            if (o !== cur && ns[o].marks[dt.target] < 3) ns[o].points += value;
          });
        } else {
          const open = players.some((o) => o !== cur && ns[o].marks[dt.target] < 3);
          if (open) me.points += value;
        }
      }
    }
    me.rounds += 1;
    setState(ns);
    setDarts([]);

    if (variant === "noscore") {
      if (allClosed(ns[cur].marks)) return finish(ns, cur);
    } else if (variant === "cutthroat") {
      if (players.some((u) => allClosed(ns[u].marks))) {
        let winner = players[0];
        players.forEach((u) => {
          if (ns[u].points < ns[winner].points) winner = u;
        });
        return finish(ns, winner);
      }
    } else {
      const closedAll = allClosed(ns[cur].marks);
      const leads = players.every((u) => u === cur || ns[cur].points >= ns[u].points);
      if (closedAll && leads) return finish(ns, cur);
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

  const markSymbol = (n) => (n <= 0 ? "" : n === 1 ? "/" : n === 2 ? "✕" : "⊗");
  const variantLabel =
    variant === "cutthroat" ? "Cutthroat" : variant === "noscore" ? "No-score" : "Score";

  // numbers the current player still needs to close
  const openTargets = X01_TARGETS.filter((t) => state[cur].marks[t] < 3).map(numOf);
  const boardHits = darts.map((d) => ({ n: numOf(d.target), mult: d.ring }));

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
          Cricket · {variantLabel}
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
              {variant !== "noscore" && <th>Pts</th>}
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
                {variant !== "noscore" && (
                  <td className="num" style={{ color: "var(--amber)" }}>
                    {state[u].points}
                  </td>
                )}
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
              style={{ fontSize: "calc(16px * var(--fs))", padding: "15px 0", opacity: darts.length >= 3 ? 0.4 : 1 }}
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
              style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}
              onClick={() => removeDart(i)}
            >
              {d.ring === 1 ? "S" : d.ring === 2 ? "D" : "T"}
              {d.target} ✕
            </button>
          ))}
          {darts.length === 0 && <span className="tag">no darts entered yet</span>}
        </div>

        <div className="row mt-12">
          <button className="btn" style={{ flex: 1 }} onClick={undo} disabled={!darts.length && !history.length}>
            Undo
          </button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={endTurn}>
            End turn
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <DartBoard highlight={openTargets} hits={boardHits} />
        </div>
      </div>
    </div>
  );
}
