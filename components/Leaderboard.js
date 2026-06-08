import { useState } from "react";
import { BackBar } from "./ui";

export default function Leaderboard({ usernames, stats, elo, openProfile, back }) {
  const [mode, setMode] = useState("overall");

  const rows = usernames
    .map((u) => ({ u, s: stats[u], elo: elo[u] || 1500 }))
    .filter((r) => r.s)
    .sort((a, b) => {
      if (mode === "x01") return b.s.x01.threeDartAvg - a.s.x01.threeDartAvg;
      if (mode === "cricket") return b.s.cricket.mpr - a.s.cricket.mpr;
      return b.elo - a.elo;
    });

  return (
    <div className="fade">
      <BackBar back={back} title="Standings" />

      <div className="row mb-12">
        {[
          ["overall", "Overall"],
          ["x01", "X01"],
          ["cricket", "Cricket"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`btn ${mode === k ? "btn-primary" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setMode(k)}
          >
            {l}
          </button>
        ))}
      </div>

      {rows.length === 0 && <p className="subtle">No completed games yet.</p>}

      <div className="stack-8">
        {rows.map((r, i) => (
          <div
            key={r.u}
            className="card pad-sm clickable"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
            onClick={() => openProfile(r.u)}
          >
            <div
              className="num"
              style={{ fontSize: 20, width: 22, color: i === 0 ? "var(--amber)" : "var(--muted)" }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.u}</div>
              <div className="tag" style={{ marginTop: 2 }}>
                {mode === "x01" &&
                  `3-dart avg ${r.s.x01.threeDartAvg.toFixed(1)} · ${r.s.x01.wins}-${r.s.x01.games - r.s.x01.wins}`}
                {mode === "cricket" &&
                  `MPR ${r.s.cricket.mpr.toFixed(2)} · ${r.s.cricket.wins}-${r.s.cricket.games - r.s.cricket.wins}`}
                {mode === "overall" &&
                  `win% ${r.s.winPct.toFixed(0)} · ${r.s.wins}-${r.s.games - r.s.wins}`}
              </div>
            </div>
            <div className="num" style={{ fontSize: 17, color: "var(--accent)" }}>
              {mode === "x01"
                ? r.s.x01.threeDartAvg.toFixed(1)
                : mode === "cricket"
                ? r.s.cricket.mpr.toFixed(2)
                : Math.round(r.elo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
