import { feedback } from "@/lib/feedback";
import { useState, useEffect } from "react";
import DartBoard from "./DartBoard";
import { dartLabel } from "@/lib/darts";
import { PlayerBadge, UndoIcon } from "./ui";
import { createRecorder, ensureRecorder, stamp, recordVisit, recordEvent, finishRecorder, stripDarts } from "@/lib/recorder";
import { playerLabel } from "@/lib/bots";
import { recommend, routeLabel } from "@/lib/strategy/x01";
import { checkoutTargets, applyCheckoutDart, CHECKOUT_DRILL_DARTS } from "@/lib/drills";

/**
 * Checkout drill: a run of random double-out finishes (41–170). Up to
 * nine darts per finish; a bust ends the visit and restores the score it
 * started on. Most finishes hit wins, fewest darts breaks the tie.
 * Always a practice drill (lib/practice.js).
 */
export default function PlayCheckoutDrill({ game, resume, onProgress, onFinish, onQuit, castActive, playerColors }) {
  const { players, config } = game;
  const n = players.length;
  const count = config.count || 10;

  const blank = () => {
    // one shared list of finishes so everyone chases the same numbers
    const targets = checkoutTargets(count);
    const s = { targets, rec: createRecorder({ players, startedAt: game.startedAt }) };
    players.forEach((u) => {
      s[u] = { idx: 0, rem: targets[0], visitStart: targets[0], dartsThis: 0, hit: 0, results: [], darts: 0, log: [], score: 0 };
    });
    return s;
  };

  const [state, setState] = useState(() => ensureRecorder(resume?.state ?? blank(), { players, startedAt: game.startedAt }));
  const [turn, setTurn] = useState(() => resume?.turn ?? 0);
  const [turnDarts, setTurnDarts] = useState(() => resume?.turnDarts ?? []);
  const [mult, setMult] = useState(() => resume?.mult ?? 1);
  const [msg, setMsg] = useState(() => resume?.msg ?? "");
  const [history, setHistory] = useState(() => resume?.history ?? []);

  useEffect(() => {
    onProgress && onProgress({ state, turn, turnDarts, mult, msg, history });
  }, [state, turn, turnDarts, mult, msg, history, onProgress]);

  const cur = players[turn % n];
  const me = state[cur];
  const targets = state.targets;
  const isDone = (s, u) => s[u].idx >= count;

  const finish = (ns) => {
    const completedAt = new Date().toISOString();
    const perPlayer = {};
    players.forEach((u) => {
      const p = ns[u];
      const hitRows = p.results.filter((r) => r.hit);
      const dartsOnHits = hitRows.reduce((a, r) => a + r.darts, 0);
      perPlayer[u] = {
        finishes: count,
        hit: p.hit,
        dartsPerHit: hitRows.length ? Math.round((dartsOnHits / hitRows.length) * 10) / 10 : 0,
        highestCheckout: hitRows.length ? Math.max(...hitRows.map((r) => r.target)) : 0,
        dartsThrown: p.darts,
        darts: p.log,
        results: p.results,
        ...finishRecorder(ns.rec, u, completedAt),
      };
    });
    const rank = (u) => ns[u].hit * 10000 - ns[u].darts;
    const winner = [...players].sort((a, b) => rank(b) - rank(a))[0];
    onFinish({ id: game.id, gameType: "checkoutDrill", config, players, winner, perPlayer, completedAt });
  };

  /** Close the current finish for `p` (hit or out of darts) and load the next. */
  const advanceFinish = (p, hit, dartsUsed) => {
    p.results = [...p.results, { target: targets[p.idx], darts: dartsUsed, hit }];
    if (hit) p.hit += 1;
    p.score = p.hit;
    p.idx += 1;
    const next = targets[p.idx] != null ? targets[p.idx] : 0;
    p.rem = next;
    p.visitStart = next;
    p.dartsThis = 0;
  };

  /** Commit a visit (1–3 darts). `outcome` is 'open' | 'hit' | 'bust'. */
  const commit = (darts, outcome) => {
    setHistory((h) => [...h, { state: JSON.parse(JSON.stringify(state)), turn, msg }]);
    const ns = JSON.parse(JSON.stringify(state));
    const p = ns[cur];
    const finishIdx = p.idx;
    const s0 = p.visitStart;
    p.darts += darts.length;
    p.log = [...p.log, ...stripDarts(darts)];
    p.dartsThis += darts.length;
    let note = "";
    if (outcome === "hit") {
      note = `${targets[p.idx]} checked out`;
      advanceFinish(p, true, p.dartsThis);
    } else {
      if (outcome === "bust") {
        feedback("bust");
        p.rem = p.visitStart;
        note = "Bust — back to " + p.visitStart;
      } else {
        // an open visit of three darts keeps the reduced score
        let rem = p.visitStart;
        for (const d of darts) rem = applyCheckoutDart(rem, d).rem;
        p.rem = rem;
        p.visitStart = rem;
      }
      if (p.dartsThis >= CHECKOUT_DRILL_DARTS) {
        note = `${targets[p.idx]} missed`;
        advanceFinish(p, false, p.dartsThis);
      }
    }
    const k = outcome === "open" && note.endsWith("missed") ? "miss" : outcome;
    recordVisit(ns.rec, cur, { r: finishIdx, s0, darts, out: { k, rem: k === "hit" ? 0 : k === "bust" ? s0 : p.visitStart } });
    setTurnDarts([]);
    setMult(1);

    if (players.every((u) => isDone(ns, u))) return finish(ns);
    let t = turn + 1;
    while (isDone(ns, players[t % n])) t++;
    setState(ns);
    setTurn(t);
    setMsg(note);
  };

  const addDart = (raw) => {
    const next = [...turnDarts, stamp(raw, game.startedAt)];
    // replay the visit from its start so an earlier open dart still counts
    let rem = me.visitStart;
    let status = "open";
    for (const d of next) {
      const r = applyCheckoutDart(rem, d);
      rem = r.rem;
      status = r.status;
      if (status !== "open") break;
    }
    if (status !== "open") return commit(next, status);
    if (next.length === 3 || me.dartsThis + next.length >= CHECKOUT_DRILL_DARTS) return commit(next, "open");
    setMsg("");
    setTurnDarts(next);
    setMult(1);
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
      setMsg(last.msg || "");
      return h.slice(0, -1);
    });
  };

  // live remaining for the current visit
  let liveRem = me.visitStart;
  for (const d of turnDarts) liveRem = applyCheckoutDart(liveRem, d).rem;
  // standard route for the darts left in this visit (lib/strategy/x01.js)
  const rec = liveRem >= 2 && turnDarts.length < 3 ? recommend({ remaining: liveRem, dartsLeft: 3 - turnDarts.length, doubleOut: true }) : null;
  const hint = rec && rec.route.length ? `${rec.kind === "checkout" ? "Checkout" : "Setup"}: ${routeLabel(rec.route)}` : null;
  const dartsLeft = CHECKOUT_DRILL_DARTS - me.dartsThis - turnDarts.length;

  return (
    <div className="fade">
      <div className="between mb-12">
        <div className="display" style={{ fontSize: "calc(17px * var(--fs))" }}>Checkout Drill</div>
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
                  {p.idx >= count ? "done" : active ? liveRem : p.rem}
                </div>
                <div className="tag" style={{ marginTop: 4 }}>
                  {p.hit}/{Math.min(p.idx, count)} hit · finish {Math.min(p.idx + 1, count)} of {count}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="tag">
            {playerLabel(cur)} — {castActive ? `${liveRem} left · ` : ""}{dartsLeft} dart{dartsLeft === 1 ? "" : "s"} left on {targets[me.idx]}
          </span>
          {hint && <span className="tag" style={{ color: "var(--accent)" }}>{hint}</span>}
        </div>

        <div className="flex-wrap" style={{ minHeight: 34, marginBottom: 8 }}>
          {turnDarts.length === 0 && <span className="tag">{msg || "tap a multiplier, then a number"}</span>}
          {turnDarts.map((d, i) => (
            <span key={i} className="btn" style={{ padding: "5px 10px", fontSize: "calc(13px * var(--fs))" }}>
              {dartLabel(d)}
            </span>
          ))}
        </div>

        <div className="row mb-12">
          {[1, 2, 3].map((m) => (
            <button key={m} className={`btn ${mult === m ? "btn-primary" : ""}`} style={{ flex: 1 }} onClick={() => setMult(m)}>
              {m === 1 ? "Single" : m === 2 ? "Double" : "Triple"}
            </button>
          ))}
        </div>

        <div className="grid-5">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
            <button key={num} className="chip" style={{ fontSize: "calc(15px * var(--fs))", padding: "12px 0" }} onClick={() => addDart({ n: num, mult })}>
              {num}
            </button>
          ))}
        </div>

        <div className="grid-3 mt-12">
          <button className="chip" onClick={() => addDart({ n: 25, mult: 1 })}>25</button>
          <button className="chip" onClick={() => addDart({ n: 25, mult: 2 })}>Bull</button>
          <button className="chip" onClick={() => addDart({ n: 0, mult: 0 })}>Miss</button>
        </div>
        <button className="chip chip-undo" onClick={undo} disabled={!turnDarts.length && !history.length}>
          <UndoIcon /> Undo
        </button>

        {!castActive && (
          <div style={{ marginTop: 14 }}>
            <DartBoard hits={turnDarts} />
          </div>
        )}
      </div>
    </div>
  );
}
