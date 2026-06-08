import { Stat } from "./ui";

export default function Home({ setView, stats, elo, players, matches, openProfile }) {
  const ranked = players
    .map((p) => ({ u: p.username, elo: elo[p.username] || 1500, s: stats[p.username] }))
    .sort((a, b) => b.elo - a.elo);

  const topAvg = players.length
    ? Math.max(0, ...players.map((p) => stats[p.username]?.x01.threeDartAvg || 0))
    : 0;

  return (
    <div className="fade">
      <div className="grid-3 mb-12">
        <Stat label="Players" value={players.length} />
        <Stat label="Games" value={matches.length} />
        <Stat label="Top avg" value={topAvg ? topAvg.toFixed(1) : "—"} />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: "100%", fontSize: 16, padding: 16 }}
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
              style={{ fontSize: 20, width: 24, color: i === 0 ? "var(--amber)" : "var(--muted)" }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{r.u}</div>
              <div className="tag" style={{ marginTop: 2 }}>
                {r.s ? `${r.s.wins}-${r.s.games - r.s.wins} · avg ${r.s.x01.threeDartAvg.toFixed(1)}` : "no games"}
              </div>
            </div>
            <div className="num" style={{ fontSize: 17, color: "var(--accent)" }}>
              {Math.round(r.elo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
