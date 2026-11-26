import { useState, useEffect, useRef } from "react";
import DartBoard from "./DartBoard";
import { dartLabel } from "@/lib/darts";
import { PlayerBadge, UndoIcon } from "./ui";
import { applyKillerDart, previewKillerVisit, killerAlive, killerVisitOver, describeKillerVisit } from "@/lib/killer";
import { visitEntry, undoVisit } from "@/lib/visitUndo";
import { botFor, playerLabel, isBot } from "@/lib/bots";
import { pickKillerTarget, botThrow } from "@/lib/botStrategy";
import { useBotTurn } from "@/lib/useBotTurn";
import { createRecorder, ensureRecorder, stamp, recordVisit, recordEvent, finishRecorder, stripDarts } from "@/lib/recorder";

export default function PlayKiller({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players, config } = game;
  const numbers = config.numbers; // { [player]: number }
  const startLives = config.lives || 3;

  const blank = () => ({
    lives: players.reduce((o, u) => ((o[u] = startLives), o), {}),
    killer: players.reduce((o, u) => ((o[u] = false), o), {}),
    darts: players.reduce((o, u) => ((o[u] = 0), o), {}),
    log: players.reduce((o, u) => ((o[u] = []), o), {}),
    rec: createRecorder({ players, startedAt: game.startedAt }),
  });

  const [s, setS] = useState(() => ensureRecorder(resume?.s ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [mult, setMult] = useState(() => resume?.mult ?? 1);
  const [history, setHistory] = useState(() => resume?.history ?? []);
  const doneRef = useRef(false);
  const rules = { players, numbers };

  useEffect(() => {
    onProgress && onProgress({ s, turn, turnDarts, mult, history });
  }, [s, turn, turnDarts, mult, history, onProgress]);

  // the throw order is fixed; eliminated players are skipped in place
  const cur = (() => {
    for (let k = 0; k < players.length; k++) {
      const u = players[(turn + k) % players.length];
      if (s.lives[u] > 0) return u;
    }
    return players[0];
  })();

  const addDart = (raw) => {
    if (turnDarts.length >= 3) return;
    const next = [...turnDarts, stamp(raw, game.startedAt)];
    setMult(1); // back to Single after every dart
    // the third dart ends the visit, and so does the one that leaves a
    // single player standing: the game is over on that dart
    if (killerVisitOver(s, cur, next, rules)) return endTurn(next, true);
    setTurnDarts(next);
  };

  // `auto`: the visit ended on a dart rather than the End turn button, so
  // Undo takes back just that dart (lib/visitUndo.js)
  const endTurn = (darts = turnDarts, auto = false) => {
    setHistory((h) => [...h, visitEntry({ s, turn, by: cur, darts, auto })]);
    const ns = JSON.parse(JSON.stringify(s));

    ns.darts[cur] += darts.length;
    ns.log[cur] = [...ns.log[cur], ...stripDarts(darts)];
    const s0 = { l: ns.lives[cur], k: ns.killer[cur] };
    const evs = [];

    for (const d of darts) {
      for (const e of applyKillerDart(ns, cur, d, rules)) {
        recordEvent(ns.rec, { ...e, turn });
        evs.push(e);
      }
    }
    recordVisit(ns.rec, cur, { r: Math.floor(turn / players.length), s0, darts, out: { l: ns.lives[cur], k: ns.killer[cur], ev: evs.length } });
    // the visit just thrown, for the "last visit" line the next thrower sees
    ns.last = { by: cur, darts: stripDarts(darts), ev: evs };

    setTurnDarts([]);
    setMult(1);

    const alive = killerAlive(ns, players);
    if (alive.length <= 1) {
      const winner = alive[0] || cur;
      doneRef.current = true;
      const completedAt = new Date().toISOString();
      const perPlayer = {};
      players.forEach((u) => {
        perPlayer[u] = {
          dartsThrown: ns.darts[u],
          livesRemaining: ns.lives[u],
          isKiller: ns.killer[u],
          darts: ns.log[u],
          ...finishRecorder(ns.rec, u, completedAt),
        };
      });
      onFinish({
        id: game.id,
        gameType: "killer",
        config,
        players,
        winner,
        perPlayer,
        completedAt,
      });
      return;
    }

    setS(ns);
    // next player in the fixed order who is still alive
    let t = turn + 1;
    while (ns.lives[players[t % players.length]] <= 0) t++;
    setTurn(t);
  };

  // a person's Undo passes over a bot's visit: taking it back would only
  // make the bot throw again
  const skipBots = (e) => isBot(e.by);
  const canUndo = turnDarts.length > 0 || !!undoVisit(history, { skip: skipBots });
  const undo = () => {
    if (turnDarts.length > 0) {
      setTurnDarts((d) => d.slice(0, -1));
      return;
    }
    // reopen the last visit with only its final dart removed
    const back = undoVisit(history, { skip: skipBots });
    if (!back) return;
    setS(back.entry.s);
    setTurn(back.entry.turn);
    setTurnDarts(back.entry.darts);
    setMult(1);
    setHistory(back.history);
  };

  // the visit in progress, applied: the header and the bot both need to
  // know what the darts already thrown this turn have done
  const live = previewKillerVisit(s, cur, turnDarts, rules);

  // a bot at the oche throws at its own double until it is a killer, then
  // at the weakest opponent's; it stops early once nobody is left to hit
  const bot = botFor(cur);
  useBotTurn({
    active: !!bot && !doneRef.current,
    key: `${turn}:${turnDarts.length}`,
    throwOne: () => {
      const target = pickKillerTarget({ me: cur, players, numbers, lives: live.lives, killer: live.killer });
      if (!target) return endTurn();
      const land = botThrow(bot, target);
      addDart({ n: land.n, mult: land.mult });
    },
  });
  const botLock = bot ? { opacity: 0.5, pointerEvents: "none" } : undefined;

  // the cards follow the darts as they land; the lives a visit has taken
  // so far show as a "−1" beside the victim
  const lost = (u) => Math.max(0, s.lives[u] - live.lives[u]);
  const inPlay = killerAlive(live, players);
  const quick = [cur, ...inPlay.filter((u) => u !== cur)];
  const playNums = new Set(inPlay.map((u) => numbers[u]));
  const myDarts = (u) => s.darts[u] + (u === cur ? turnDarts.length : 0);
  // what the previous thrower's visit did, until this visit's first dart
  const last = s.last && s.last.by !== cur && turnDarts.length === 0 && !bot ? s.last : null;

  const livesDisplay = (n) => {
    const full = Math.max(0, n);
    return Array.from({ length: startLives }, (_, i) => (i < full ? "/" : " ")).join("");
  };

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>
          Killer
        </div>
        <button className="btn btn-danger" style={{ padding: "7px 12px" }} onClick={onQuit}>
          Quit
        </button>
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
            const active = u === cur;
            const dead = live.lives[u] <= 0;
            return (
              <div
                key={u}
                className="card pad-sm"
                style={{
                  borderColor: active ? "var(--live)" : "var(--line)",
                  background: active ? "var(--live-soft)" : dead ? "var(--surface)" : "var(--surface)",
                  opacity: dead ? 0.45 : 1,
                }}
              >
                <div className="between">
                  <PlayerBadge username={u} color={playerColors?.[u]} size={20} />
                  {active && <span className="tag" style={{ color: "var(--accent)" }}>at the oche</span>}
                </div>
                <div className="between" style={{ marginTop: 4 }}>
                  <span className="tag">#{numbers[u]}</span>
                  <span
                    className="tag"
                    style={{ color: live.killer[u] ? "var(--red)" : "var(--muted)", fontWeight: 600 }}
                  >
                    {live.killer[u] ? "KILLER" : "not killer"}
                  </span>
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: "calc(28px * var(--fs))",
                    lineHeight: 1.1,
                    marginTop: 4,
                    letterSpacing: 4,
                    color: live.lives[u] <= 1 ? "var(--red)" : "var(--ink)",
                  }}
                >
                  {livesDisplay(live.lives[u])}
                  {lost(u) > 0 && <span key={lost(u)} className="killer-lost">−{lost(u)}</span>}
                </div>
                <div className="tag" style={{ marginTop: 4 }}>
                  {dead ? "out" : `${live.lives[u]} ${live.lives[u] === 1 ? "life" : "lives"}`} · {myDarts(u)} darts
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">
            {playerLabel(cur)} — {live.killer[cur] ? "killer" : "become a killer (D" + numbers[cur] + ")"}
            {castActive ? ` · #${numbers[cur]}` : ""}
            {bot ? " · throwing…" : ""}
          </span>
        </div>

        {last && (
          <div className="killer-last" role="status">
            <b>{playerLabel(last.by)}</b>'s last visit: {last.darts.length ? last.darts.map(dartLabel).join(" · ") : "no darts"} — {describeKillerVisit(last.ev, { me: cur, label: playerLabel })}
          </div>
        )}

        <div className="flex-wrap" style={{ minHeight: 34, marginBottom: 8 }}>
          {turnDarts.length === 0 && <span className="tag">tap a double below, or a multiplier then a number</span>}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {dartLabel(d)}
            </span>
          ))}
        </div>

        <div style={botLock}>
        {/* only doubles count in Killer: the ones in play, one tap each */}
        <div className="killer-quick" role="group" aria-label="Doubles in play">
          {quick.map((u) => {
            const own = u === cur;
            const note = own ? (live.killer[cur] ? "own · −1 life" : "become killer") : playerLabel(u);
            const idle = !own && !live.killer[cur];
            return (
              <button
                key={u}
                type="button"
                className={`chip killer-quick-btn${own ? " is-own" : ""}${idle ? " is-idle" : ""}`}
                onClick={() => addDart({ n: numbers[u], mult: 2 })}
              >
                <span className="killer-quick-d">D{numbers[u]}</span>
                <span className="killer-quick-note">{note}</span>
              </button>
            );
          })}
        </div>

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
            <button key={n} className={`chip${playNums.has(n) ? " killer-num" : ""}`} style={{ fontSize: "calc(15px * var(--fs))", padding: "12px 0" }} onClick={() => addDart({ n, mult })}>
              {n}
            </button>
          ))}
        </div>

        <div className="grid-3 mt-12">
          <button className="chip" onClick={() => addDart({ n: 25, mult: 1 })}>25</button>
          <button className="chip" onClick={() => addDart({ n: 25, mult: 2 })}>Bull</button>
          <button className="chip" onClick={() => addDart({ n: 0, mult: 0 })}>Miss</button>
        </div>
        <button className="chip chip-undo" onClick={undo} disabled={!canUndo}>
          <UndoIcon /> Undo
        </button>

        <div className="row mt-12">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => endTurn()}>
            End turn
          </button>
        </div>
        </div>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard highlight={inPlay.map((u) => numbers[u])} hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
