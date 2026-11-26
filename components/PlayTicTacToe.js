import { useState, useEffect } from "react";
import DartBoard from "./DartBoard";
import { dartLabel } from "@/lib/darts";
import { UndoIcon } from "./ui";
import { TTT_GRID as GRID, applyTicTacToeVisit, ticTacToeDartOutcome } from "@/lib/gamestats/tictactoe";
import { visitEntry, undoVisit } from "@/lib/visitUndo";
import { createRecorder, ensureRecorder, stamp, recordVisit, finishRecorder, stripDarts } from "@/lib/recorder";

export default function PlayTicTacToe({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players, config } = game;

  const blank = () => ({
    board: Array(9).fill(null),
    darts: players.reduce((o, u) => ((o[u] = 0), o), {}),
    log: players.reduce((o, u) => ((o[u] = []), o), {}),
    rec: createRecorder({ players, startedAt: game.startedAt }),
  });

  const [s, setS] = useState(() => ensureRecorder(resume?.s ?? blank(), { players, startedAt: game.startedAt }));
  // board as a 9-char string of player indexes ('.' = free) for the stats log
  const boardStr = (b) => b.map((o) => (o == null ? "." : String(players.indexOf(o)))).join("");
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [history, setHistory] = useState(() => resume?.history ?? []);
  // the dart that completes a line waits here until it's confirmed (or
  // undone), as X01's match-winning dart does, so a mis-tapped cell can't
  // save a ranked result
  const [pendingWin, setPendingWin] = useState(() => resume?.pendingWin ?? false);

  useEffect(() => {
    onProgress && onProgress({ s, turn, turnDarts, history, pendingWin });
  }, [s, turn, turnDarts, history, pendingWin, onProgress]);

  const cur = players[turn % players.length];

  // the grid is the keypad: a tap is a dart at that number. The third dart
  // ends the visit, as in the other games; the dart that completes a line
  // ends the game once confirmed
  const addDart = (raw) => {
    if (pendingWin || turnDarts.length >= 3) return;
    const next = [...turnDarts, stamp(raw, game.startedAt)];
    const kind = ticTacToeDartOutcome(s.board, cur, next);
    if (kind === "win") {
      setTurnDarts(next);
      setPendingWin(true);
      return;
    }
    if (kind === "end") return endTurn(next);
    setTurnDarts(next);
  };

  const confirmWin = () => {
    if (!pendingWin) return;
    setPendingWin(false);
    endTurn(turnDarts);
  };

  const endTurn = (darts) => {
    setHistory((h) => [...h, visitEntry({ s, turn, by: cur, darts })]);
    const ns = JSON.parse(JSON.stringify(s));
    ns.darts[cur] += darts.length;
    ns.log[cur] = [...ns.log[cur], ...stripDarts(darts)];
    const s0 = boardStr(s.board);
    const { board, claimed, cancelled, won } = applyTicTacToeVisit(ns.board, cur, darts);
    ns.board = board;
    recordVisit(ns.rec, cur, { r: Math.floor(turn / players.length), s0, darts, out: { b: boardStr(ns.board), c: claimed, x: cancelled } });

    if (won) {
      const completedAt = new Date().toISOString();
      const perPlayer = {};
      players.forEach((u) => {
        perPlayer[u] = {
          squaresClaimed: ns.board.filter((c) => c === u).length,
          dartsThrown: ns.darts[u],
          darts: ns.log[u],
          line: won.line,
          ...finishRecorder(ns.rec, u, completedAt),
        };
      });
      onFinish({
        id: game.id,
        gameType: "tictactoe",
        config,
        players,
        winner: won.winner,
        perPlayer,
        completedAt,
      });
      return;
    }

    // If all 9 squares are claimed (no nulls) and no winner, reset board
    if (ns.board.every((c) => c !== null)) {
      ns.board = Array(9).fill(null);
    }

    setS(ns);
    setTurnDarts([]);
    setTurn((t) => t + 1);
  };

  const undo = () => {
    if (pendingWin) setPendingWin(false);
    if (turnDarts.length > 0) {
      setTurnDarts((d) => d.slice(0, -1));
      return;
    }
    // reopen the last visit with only its final dart removed
    const back = undoVisit(history);
    if (!back) return;
    setS(back.entry.s);
    setTurn(back.entry.turn);
    setTurnDarts(back.entry.darts);
    setHistory(back.history);
  };

  // the visit so far, applied: pending claims and cancels show on the grid
  const preview = applyTicTacToeVisit(s.board, cur, turnDarts);

  const p1 = players[0];
  const p2 = players[1];

  const c1 = playerColors?.[p1] || "var(--accent)";
  const c2 = playerColors?.[p2] || "var(--amber)";
  const sameColor = c1 === c2;
  const p1Color = sameColor ? "var(--accent)" : c1;
  const p2Color = sameColor ? "var(--amber)" : c2;

  const cellColor = (owner) =>
    owner === p1 ? p1Color : owner === p2 ? p2Color : "transparent";
  const cellInitial = (owner) =>
    owner ? owner.charAt(0).toUpperCase() : "";

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
          Tic-Tac-Toe
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
      </div>

      <div className="card mb-12">
        <div className="between" style={{ marginBottom: 10 }}>
          <span style={{ fontWeight: 700, color: cur === p1 ? p1Color : p2Color }}>
            {cur} — dart {Math.min(turnDarts.length + 1, 3)} of 3
          </span>
          <span className="tag">
            <span style={{ color: p1Color }}>{p1}</span>
            {" vs "}
            <span style={{ color: p2Color }}>{p2}</span>
          </span>
        </div>

        {pendingWin ? (
          <div className="x01-confirm" role="alertdialog" aria-label="Confirm win">
            <div className="x01-confirm-text">
              {cur} completes a line on {dartLabel(turnDarts[turnDarts.length - 1])}
            </div>
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>
              Wrong cell? Undo the dart. The result is saved once you confirm.
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" style={{ flex: 1 }} onClick={undo}>
                <UndoIcon /> Undo dart
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmWin}>
                Confirm win
              </button>
            </div>
          </div>
        ) : (
          <div className="tag" style={{ marginBottom: 8 }}>tap the number each dart hit</div>
        )}

        {/* 3x3 grid: the input */}
        <div className="ttt-grid" role="group" aria-label="Tic-Tac-Toe grid">
          {GRID.map((num, idx) => {
            const owner = preview.board[idx];
            const was = s.board[idx];
            const pendingClaim = preview.claimed.includes(idx) && owner === cur;
            const pendingCancel = was && !owner;
            const color = cellColor(owner || (pendingCancel ? was : null));
            return (
              <button
                key={idx}
                type="button"
                className={`ttt-cell${pendingClaim ? " is-pending" : ""}${pendingCancel ? " is-cancel" : ""}`}
                style={{
                  borderColor: owner || pendingCancel ? color : undefined,
                  background: owner && !pendingClaim ? `color-mix(in srgb, ${color} 10%, transparent)` : undefined,
                  "--ttt-color": color,
                }}
                disabled={pendingWin || turnDarts.length >= 3}
                onClick={() => addDart({ n: num, mult: 1 })}
                aria-label={`${num}${owner ? `, ${owner}'s` : ""}${pendingClaim ? " (claiming)" : ""}${pendingCancel ? " (cancelling)" : ""}`}
              >
                <span className="ttt-num" style={{ color: owner ? color : undefined }}>{num}</span>
                <span className="ttt-owner" style={{ color }}>
                  {pendingCancel ? "✕" : pendingClaim ? `+${cellInitial(owner)}` : cellInitial(owner)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ttt-actions">
          <button className="chip" onClick={() => addDart({ n: 0, mult: 0 })} disabled={pendingWin || turnDarts.length >= 3}>
            Miss
          </button>
        </div>

        <div className="flex-wrap" style={{ marginTop: 10, minHeight: 30 }}>
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {dartLabel(d)}
            </span>
          ))}
          {turnDarts.length === 0 && <span className="tag">a number off the grid is a miss</span>}
        </div>

        {/* while a win waits for its confirm, Undo lives in the confirm panel */}
        {!pendingWin && (
          <button className="chip chip-undo" onClick={undo} disabled={!turnDarts.length && !history.length}>
            <UndoIcon /> Undo
          </button>
        )}

        {!castActive && (
          <>
            <div className="tag" style={{ textAlign: "center", marginTop: 10 }}>
              {p1}: {s.darts[p1]} darts · {p2}: {s.darts[p2]} darts
            </div>
            <div style={{ marginTop: 14 }}>
              <DartBoard highlight={GRID} hits={turnDarts} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
