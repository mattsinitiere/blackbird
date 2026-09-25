import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AIChart from "./AIChart";
import AIText from "./AIText";
import { BackBar, PlayerBadge } from "./ui";
import { LineChart, BarChart } from "./Charts";
import { analyzeMatch } from "@/lib/gamestats";
import { gameTitle } from "@/lib/summary";
import { dartLabel } from "@/lib/darts";
import { clockLabel } from "@/lib/gamestats/clock";
import { TTT_GRID } from "@/lib/gamestats/tictactoe";

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};
const n1 = (v) => (v == null ? "—" : Number(v).toFixed(1));
const pc = (v) => (v == null ? "—" : `${Math.round(v)}%`);

/** The handful of numbers worth a glance per game type. */
function keyMetrics(gameType, a) {
  const m = a.metrics || {};
  switch (gameType) {
    case "x01":
      return [
        ["3-dart avg", n1(m.threeDartAvg)],
        ["First 9", n1(m.first9Avg)],
        ["High turn", m.highestTurn ?? "—"],
        ...(a.won ? [["Checkout", m.checkout || "—"]] : []),
        ["Checkout %", m.checkoutChances ? `${m.checkoutHits}/${m.checkoutChances}` : "—"],
        ["Busts", m.busts ?? "—"],
        ["180s", m.one80s ?? "—"],
        ["Best visit", m.bestVisit ?? "—"],
      ];
    case "cricket":
      return [["MPR", m.mpr == null ? "—" : m.mpr.toFixed(2)], ["Marks", m.marks], ["Rounds", m.rounds], ["Points", m.points], ["Miss %", pc(m.missPct)], ["Dead darts", m.deadDarts ?? "—"], ["Best round", m.bestRound ?? "—"]];
    case "baseball":
      return [["Runs", m.runs], ["Biggest inning", m.biggestInning ?? "—"], ["Hit rate", pc(m.hitRate)], ["Triples", m.hitsBy?.T ?? "—"], ["Scoreless", m.scorelessInnings ?? "—"]];
    case "aroundTheClock":
      return [["Targets", `${m.targetsHit}/21`], ["Darts", a.totals.dartsThrown], ["Hit rate", pc(m.hitRate)], ["Hardest", m.hardestTarget ? `${m.hardestTarget.target} (${m.hardestTarget.darts}d)` : "—"]];
    case "killer":
      return [["Lives left", m.livesRemaining ?? "—"], ["Killer", m.isKiller ? "yes" : "no"], ["Darts to killer", m.dartsToBecomeKiller ?? "—"], ["Kills", m.kills ?? "—"], ["Lives taken", m.livesTaken ?? "—"], ["Lives lost", m.livesLost ?? "—"]];
    case "shanghai":
      return [["Total", m.totalScore], ["Best round", m.bestRound ?? "—"], ["Hit rate", pc(m.hitRate)], ["Shanghai", m.shanghai ? "yes" : "no"]];
    case "halveit":
      return [["Final", m.finalScore ?? "—"], ["Halved", `${m.halves ?? "—"}×`], ["Best round", m.bestRound ?? "—"], ["Target hit %", pc(m.targetHitPct)]];
    case "gotcha":
      return [["Final", m.finalScore ?? "—"], ["Busts", m.busts ?? "—"], ["Resets dealt", m.resetsDealt ?? "—"], ["Reset", `${m.resetsReceived ?? "—"}×`], ["Darts", a.totals.dartsThrown]];
    case "tictactoe":
      return [["Squares", m.squaresClaimed ?? "—"], ["Claimed", m.claimed ?? "—"], ["Canceled", m.cancelled ?? "—"], ["Darts/claim", m.dartsPerClaim ?? "—"]];
    case "bobs27":
      return [["Score", m.finalScore ?? "—"], ["Doubles", m.doublesHit ?? "—"], ["Rounds", m.roundsCompleted ?? "—"], ["Hit rate", pc(m.doubleHitRate)], ...(m.busted ? [["Busted", `round ${m.bustRound}`]] : [])];
    case "checkoutDrill":
      return [["Hit", `${m.hit}/${m.finishes}`], ["Darts / hit", n1(m.dartsPerHit)], ["Highest", m.highestCheckout || "—"], ["Busts", m.busts ?? "—"]];
    case "scoringDrill":
      return [["Total", m.total], ["Per visit", n1(m.avgPerVisit)], ["Best visit", m.bestVisit ?? "—"], ["Hit rate", pc(m.hitRate)], ["Triples", m.trebles ?? "—"]];
    default:
      return [["Darts", a.totals.dartsThrown]];
  }
}

/** One chart per player: the per-round shape of the game. */
function seriesFor(gameType, a) {
  const s = a.series || {};
  switch (gameType) {
    case "x01": return { title: "Points per visit", data: s.visitScores, type: "bar" };
    case "cricket": return { title: "Marks per round", data: s.marksPerRound, type: "bar" };
    case "baseball": return { title: "Runs per inning", data: s.runsPerInning, type: "bar" };
    case "aroundTheClock": return { title: "Darts per target", data: s.dartsPerTarget, type: "bar" };
    case "killer": return { title: "Lives after each turn", data: s.lives, type: "line" };
    case "shanghai": return { title: "Points per round", data: s.roundScores, type: "bar" };
    case "halveit": return { title: "Score after each round", data: s.score, type: "line" };
    case "gotcha": return { title: "Score after each visit", data: s.score, type: "line" };
    case "bobs27": return { title: "Score after each double", data: s.score, type: "line" };
    case "checkoutDrill": return { title: "Darts per finish", data: s.dartsPerFinish, type: "bar" };
    case "scoringDrill": return { title: "Points per visit", data: s.visitScores, type: "bar" };
    default: return null;
  }
}

function roundLabel(gameType, v) {
  const r = (v.r || 0) + 1;
  if (gameType === "x01") return `Leg ${r}`;
  if (gameType === "baseball") return `Inn ${r}`;
  if (gameType === "checkoutDrill") return `Finish ${r}`;
  if (gameType === "aroundTheClock" || gameType === "gotcha" || gameType === "killer" || gameType === "tictactoe") return `Turn ${v.i + 1}`;
  return `R${r}`;
}

function outcomeText(gameType, v) {
  const o = v.out || {};
  switch (gameType) {
    case "x01": return o.k === "bust" ? "Bust" : o.k === "win" ? `Out on ${v.s0}` : `${o.s} → ${o.rem}`;
    case "cricket": return `${o.marks ?? 0} marks${o.pts ? ` · +${o.pts}` : ""}${o.dead ? ` · ${o.dead} dead` : ""}`;
    case "baseball": return `${o.runs ?? 0} run${o.runs === 1 ? "" : "s"}`;
    case "aroundTheClock": return o.hit ? `+${o.hit} → ${o.tgt > 21 ? "done" : clockLabel(o.tgt)}` : "no hit";
    case "killer": return `${o.k && !(v.s0 && v.s0.k) ? "became killer · " : ""}${o.l} ${o.l === 1 ? "life" : "lives"}${o.ev ? ` · ${o.ev} hit${o.ev === 1 ? "" : "s"}` : ""}`;
    case "shanghai": return `+${o.s ?? 0}${o.sh ? " · Shanghai!" : ""}`;
    case "halveit": return o.halved ? `Halved → ${o.sc}` : `+${o.s} → ${o.sc}`;
    case "gotcha": return o.k === "bust" ? "Bust" : o.k === "win" ? "Gotcha!" : `+${o.s} → ${o.sc}${o.reset && o.reset.length ? ` · reset ${o.reset.join(", ")}` : ""}`;
    case "tictactoe": return [o.c && o.c.length ? `claimed ${o.c.map((i) => TTT_GRID[i]).join(", ")}` : "", o.x && o.x.length ? `canceled ${o.x.map((i) => TTT_GRID[i]).join(", ")}` : ""].filter(Boolean).join(" · ") || "no change";
    case "bobs27": return `${o.delta > 0 ? "+" : ""}${o.delta} → ${o.sc}`;
    case "checkoutDrill": return o.k === "hit" ? "Out!" : o.k === "bust" ? "Bust" : o.k === "miss" ? "Missed" : `→ ${o.rem}`;
    case "scoringDrill": return `+${o.s ?? 0}`;
    default: return "";
  }
}

/**
 * Match report: every player's numbers side by side, a per-round chart
 * each, and the visit-by-visit timeline with each dart. Works for saved
 * games (rows from the database) and for the game just finished.
 */
export default function GameDetail({ rows, playerColors, back, me = null, onAskAI = null }) {
  const match = useMemo(() => analyzeMatch(rows), [rows]);
  if (!match) return null;
  const { gameType, config, winner, players } = match;
  const names = rows.map((r) => r.username);
  const first = players[names[0]];
  const durationMs = first?.totals?.durationMs;
  const notes = [...new Set(names.flatMap((u) => players[u].quality.notes || []))];

  // merge visits into one timeline: by throw time when every dart is timed,
  // else by round, visit and player order
  const timed = names.every((u) => players[u].quality.hasTimes);
  const timeline = names
    .flatMap((u, pi) => players[u].visits.map((v) => ({ u, pi, v, t: v.darts?.[0]?.t ?? 0 })))
    .sort((a, b) => (timed ? a.t - b.t : (a.v.r || 0) - (b.v.r || 0) || a.v.i - b.v.i || a.pi - b.pi));

  return (
    <div className="fade">
      <BackBar back={back} title="Match report" />

      <div className="card mb-12">
        <div className="display" style={{ fontSize: "calc(18px * var(--fs))" }}>{gameTitle(gameType, config)}</div>
        <div className="tag" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
          {fmtDate(match.completedAt)}
          {durationMs ? ` · ${Math.max(1, Math.round(durationMs / 60000))} min` : ""}
        </div>
        {winner && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="tag">Winner</span>
            <PlayerBadge username={winner} color={playerColors?.[winner]} size={22} />
          </div>
        )}
      </div>

      {me && match.gameId && names.includes(me) && <AIReport gameId={match.gameId} me={me} />}
      {onAskAI && me && match.gameId && names.includes(me) && (
        <button
          type="button"
          className="btn mb-12"
          style={{ width: "100%" }}
          onClick={() => onAskAI(`Talk me through my ${gameTitle(gameType, config)} game on ${fmtDate(match.completedAt)} (game id ${match.gameId}): what decided it, and what should I practice?`)}
        >
          Ask Merlin About This Game
        </button>
      )}

      <div className="report-grid mb-12">
        {names.map((u) => {
          const a = players[u];
          return (
            <div key={u} className={`card pad-sm${a.won ? " is-winner" : ""}`}>
              <div className="between" style={{ marginBottom: 8 }}>
                <PlayerBadge username={u} color={playerColors?.[u]} size={24} />
                {a.won != null && <span className="tag" style={{ color: a.won ? "var(--accent)" : "var(--muted)" }}>{a.won ? "won" : "lost"}</span>}
              </div>
              <dl className="report-metrics">
                {keyMetrics(gameType, a).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      {names.map((u) => {
        const sf = seriesFor(gameType, players[u]);
        if (!sf || !sf.data || sf.data.length < 2) return null;
        return (
          <div key={`chart-${u}`} className="card mb-12">
            <div className="between" style={{ marginBottom: 6 }}>
              <h3 className="section-title" style={{ margin: 0 }}>{sf.title}</h3>
              <PlayerBadge username={u} color={playerColors?.[u]} size={18} />
            </div>
            {sf.type === "line" ? <LineChart data={sf.data} /> : <BarChart data={sf.data} />}
          </div>
        );
      })}

      <div className="card mb-12">
        <h3 className="section-title">Visit by visit</h3>
        {timeline.length === 0 && (
          <p className="subtle" style={{ margin: 0 }}>
            No dart-by-dart log for this game.
          </p>
        )}
        {timeline.map(({ u, v }, i) => (
          <div key={i} className="report-visit">
            <PlayerBadge username={u} color={playerColors?.[u]} size={18} showName={false} />
            <span className="tag report-visit-round">{roundLabel(gameType, v)}</span>
            <span className="report-darts">
              {(v.darts || []).map((d, di) => (
                <span key={di} className={`report-dart${d.n === 0 || d.mult === 0 ? " miss" : ""}`}>{dartLabel(d)}</span>
              ))}
            </span>
            <span className="report-outcome">{outcomeText(gameType, v)}</span>
          </div>
        ))}
      </div>

      {notes.length > 0 && (
        <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "0 4px 12px" }}>
          Limited data: {notes.join("; ")}.
        </p>
      )}
    </div>
  );
}

/**
 * Blackbird AI's report on this one game (app/api/insights kind "game").
 * Asked for on tap, then kept on this phone per game so reopening it is
 * instant and costs nothing.
 */
function AIReport({ gameId, me }) {
  const key = `bb-ai-game-${gameId}`;
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      setReport(JSON.parse(window.localStorage.getItem(key) || "null"));
    } catch {}
  }, [key]);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ kind: "game", gameId, me }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Request failed");
      const r = { text: body.text, charts: body.charts || [] };
      try {
        window.localStorage.setItem(key, JSON.stringify(r));
      } catch {}
      setReport(r);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    return (
      <section className="card mb-12 ai-game-report" aria-label="Merlin's match analysis">
        <div className="ai-weekly-head">
          <span className="ai-weekly-title">Merlin's Analysis</span>
        </div>
        <AIText text={report.text} />
        {report.charts.map((c, i) => (
          <AIChart key={i} chart={c} />
        ))}
      </section>
    );
  }
  return (
    <div className="mb-12">
      <button type="button" className="btn btn-primary ai-analyze" onClick={run} disabled={busy}>
        {busy ? "Analyzing…" : "Analyze This Game"}
      </button>
      {error && (
        <p className="tag" style={{ margin: "6px 2px 0", textTransform: "none", letterSpacing: 0, color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
