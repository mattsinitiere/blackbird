import { useState } from "react";
import { BackBar, PlayerBadge, pressProps } from "./ui";
import { BASE_ELO } from "@/lib/constants";

export default function Leaderboard({ usernames, stats, elo, openProfile, openRecords, back, playerColors }) {
  const [mode, setMode] = useState("overall");

  const rows = usernames
    .map((u) => ({ u, s: stats[u], elo: elo[u] || BASE_ELO }))
    .filter((r) => r.s)
    .filter((r) =>
      mode === "x01"
        ? r.s.x01.games > 0
        : mode === "cricket"
        ? r.s.cricket.games > 0
        : mode === "baseball"
        ? r.s.baseball.games > 0
        : true
    )
    .sort((a, b) => {
      if (mode === "x01") return b.s.x01.threeDartAvg - a.s.x01.threeDartAvg;
      if (mode === "cricket") return b.s.cricket.mpr - a.s.cricket.mpr;
      if (mode === "baseball") return b.s.baseball.avgRuns - a.s.baseball.avgRuns;
      return b.elo - a.elo;
    });

  const sub = (s) => {
    if (mode === "x01") return `3-dart avg ${s.x01.threeDartAvg.toFixed(1)} · ${s.x01.wins}-${s.x01.games - s.x01.wins}`;
    if (mode === "cricket") return `MPR ${s.cricket.mpr.toFixed(2)} · ${s.cricket.wins}-${s.cricket.games - s.cricket.wins}`;
    if (mode === "baseball") return `avg runs ${s.baseball.avgRuns.toFixed(1)} · ${s.baseball.wins}-${s.baseball.games - s.baseball.wins}`;
    return `win% ${s.winPct.toFixed(0)} · ${s.wins}-${s.games - s.wins}`;
  };
  const big = (r) => {
    if (mode === "x01") return r.s.x01.threeDartAvg.toFixed(1);
    if (mode === "cricket") return r.s.cricket.mpr.toFixed(2);
    if (mode === "baseball") return r.s.baseball.avgRuns.toFixed(1);
    return Math.round(r.elo);
  };

  // the caption under the big number, so it never reads as an unlabeled figure
  const bigLabel = mode === "x01" ? "3-dart avg" : mode === "cricket" ? "MPR" : mode === "baseball" ? "Avg runs" : "Elo";

  const eloArrow = (s) => {
    const ch = s.eloChange || 0;
    if (ch > 0) return { symbol: "▲", color: "var(--accent)", say: `Elo up ${ch} in the last game` };
    if (ch < 0) return { symbol: "▼", color: "var(--red)", say: `Elo down ${-ch} in the last game` };
    return null;
  };

  const formDots = (s) => {
    if (!s.lastFive || s.lastFive.length === 0) return null;
    return s.lastFive;
  };

  return (
    <div className="fade">
      <BackBar back={back} title="Standings" />

      <div className="row mb-12" style={{ flexWrap: "wrap" }}>
        {[
          ["overall", "Overall"],
          ["x01", "X01"],
          ["cricket", "Cricket"],
          ["baseball", "Baseball"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`btn ${mode === k ? "btn-primary" : ""}`}
            style={{ flex: "1 1 22%" }}
            onClick={() => setMode(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {openRecords && (
        <div className="row mb-12">
          <button className="btn" style={{ flex: 1 }} onClick={openRecords}>
            Records
          </button>
        </div>
      )}

      {rows.length === 0 && (
        <p className="subtle">
          No completed games in this category yet.
          {" Standings show you and the players you follow."}
        </p>
      )}

      <div className="stack-8">
        {rows.map((r, i) => {
          const arrow = mode === "overall" ? eloArrow(r.s) : null;
          const form = formDots(r.s);
          return (
            <div
              key={r.u}
              className="card pad-sm clickable"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
              {...pressProps(() => openProfile(r.u))}
            >
              <div className="num" style={{ fontSize: "calc(20px * var(--fs))", width: "calc(22px * var(--fs))", color: i === 0 ? "var(--amber)" : "var(--muted)" }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 6px" }}>
                  <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={22} />
                  {arrow && (
                    <span className="lb-elo-change" style={{ color: arrow.color }} role="img" aria-label={arrow.say} title={arrow.say}>
                      <span aria-hidden="true">
                        {arrow.symbol}
                        {Math.abs(r.s.eloChange)} <span className="lb-elo-when">last game</span>
                      </span>
                    </span>
                  )}
                </div>
                <div className="tag" style={{ marginTop: 2 }}>
                  {sub(r.s)}
                </div>
                {/* the same W / L chips as the Matchup screen, oldest first */}
                {form && (
                  <div className="lb-form" role="img" aria-label={`Last ${form.length} games, oldest first: ${form.map((f) => (f === "W" ? "won" : "lost")).join(", ")}`}>
                    <span className="lb-form-label" aria-hidden="true">Form</span>
                    <span className="mu-pips" aria-hidden="true">
                      {form.map((f, idx) => (
                        <span key={idx} className={`mu-pip ${f === "W" ? "is-w" : "is-l"}`}>
                          {f}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
              <div className="lb-big">
                <div className="num" style={{ fontSize: "calc(17px * var(--fs))", color: "var(--accent)" }}>{big(r)}</div>
                <div className="tag lb-big-label">{bigLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
