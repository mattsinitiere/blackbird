import { useState } from "react";
import { BackBar, PlayerBadge, pressProps } from "./ui";
import { BASE_ELO } from "@/lib/constants";

// an average over one or two games isn't a standing: below this many games
// in a mode a player is listed under "Not ranked yet" instead
export const MIN_GAMES = 5;

export default function Leaderboard({ usernames, stats, elo, openProfile, openRecords, openMatchup = null, back, playerColors }) {
  const [mode, setMode] = useState("overall");

  const gamesIn = (s) => (mode === "x01" ? s.x01.games : mode === "cricket" ? s.cricket.games : mode === "baseball" ? s.baseball.games : s.games);
  const all = usernames
    .map((u) => ({ u, s: stats[u], elo: elo[u] || BASE_ELO }))
    .filter((r) => r.s && gamesIn(r.s) > 0);
  const unranked = all.filter((r) => gamesIn(r.s) < MIN_GAMES).sort((a, b) => gamesIn(b.s) - gamesIn(a.s));
  const rows = all
    .filter((r) => gamesIn(r.s) >= MIN_GAMES)
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

  const eloArrow = (s) => {
    const ch = s.eloChange || 0;
    if (ch > 0) return { symbol: "▲", color: "var(--accent)" };
    if (ch < 0) return { symbol: "▼", color: "var(--red)" };
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

      {(openRecords || openMatchup) && (
        <div className="row mb-12">
          {openRecords && (
            <button className="btn" style={{ flex: 1 }} onClick={openRecords}>
              Records
            </button>
          )}
          {openMatchup && (
            <button className="btn" style={{ flex: 1 }} onClick={openMatchup}>
              Matchup
            </button>
          )}
        </div>
      )}

      {rows.length === 0 && (
        <p className="subtle">
          {unranked.length ? `Nobody has played ${MIN_GAMES} games in this category yet.` : "No completed games in this category yet."}
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
              <div className="num" style={{ fontSize: "calc(20px * var(--fs))", width: "calc(22px * var(--fs))", color: i === 0 ? "var(--accent)" : "var(--muted)" }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={22} />
                  {arrow && (
                    <span style={{ fontSize: "calc(10px * var(--fs))", color: arrow.color }}>
                      {arrow.symbol}{Math.abs(r.s.eloChange)}
                    </span>
                  )}
                </div>
                <div className="tag" style={{ marginTop: 2 }}>
                  {sub(r.s)}
                  {form && (
                    <span style={{ marginLeft: 8 }}>
                      {form.map((f, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: "inline-block",
                            width: "calc(7px * var(--fs))",
                            height: "calc(7px * var(--fs))",
                            borderRadius: "50%",
                            background: f === "W" ? "var(--accent)" : "var(--red)",
                            marginRight: 2,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <div className="num" style={{ fontSize: "calc(17px * var(--fs))", color: "var(--accent)" }}>{big(r)}</div>
            </div>
          );
        })}
      </div>

      {unranked.length > 0 && (
        <div className="mt-12">
          <h3 className="section-title" style={{ fontSize: "calc(15px * var(--fs))" }}>Not Ranked Yet</h3>
          <div className="stack-8">
            {unranked.map((r) => (
              <div key={r.u} className="card pad-sm clickable" style={{ display: "flex", alignItems: "center", gap: 12 }} {...pressProps(() => openProfile(r.u))}>
                <div style={{ flex: 1 }}>
                  <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={22} />
                </div>
                <span className="tag tag-plain">
                  {gamesIn(r.s)} of {MIN_GAMES} games
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
