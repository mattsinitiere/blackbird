import { Stat } from "./ui";
import { BASE_ELO } from "@/lib/constants";

export default function Home({ setView, stats, elo, players, gameCount, openProfile }) {
  const visible = players.filter((p) => !p.hidden);
  const ranked = visible
    .map((p) => ({ u: p.username, elo: elo[p.username] || BASE_ELO, s: stats[p.username] }))
    .sort((a, b) => b.elo - a.elo);

  const topAvg = visible.length
    ? Math.max(0, ...visible.map((p) => stats[p.username]?.x01.threeDartAvg || 0))
    : 0;

  return (
    <div className="fade">
      <div className="grid-3 mb-12">
        <Stat label="Players" value={visible.length} />
        <Stat label="Games" value={gameCount} />
        <Stat label="Top avg" value={topAvg ? topAvg.toFixed(1) : "—"} />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: "100%", fontSize: "calc(16px * var(--fs))", padding: 16 }}
        onClick={() => setView("setup")}
      >
        Start a game
      </button>

      <hr className="sep" />
      <h2 className="section-title">Top of the board</h2>

      {ranked.length === 0 && (
        <p className="subtle">No players yet. Start a game to add some.</p>
      )}

      <div className="stack-8">
        {ranked.slice(0, 5).map((r, i) => (
          <div
            key={r.u}
            className="card pad-sm clickable"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
            onClick={() => openProfile(r.u)}
          >
            <div
              className="num"
              style={{ fontSize: "calc(20px * var(--fs))", width: "calc(24px * var(--fs))", color: i === 0 ? "var(--amber)" : "var(--muted)" }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.u}</div>
              <div className="tag" style={{ marginTop: 2 }}>
                {r.s ? `${r.s.wins}-${r.s.games - r.s.wins} · avg ${r.s.x01.threeDartAvg.toFixed(1)}` : "no games"}
              </div>
            </div>
            <div className="num" style={{ fontSize: "calc(17px * var(--fs))", color: "var(--accent)" }}>
              {Math.round(r.elo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
