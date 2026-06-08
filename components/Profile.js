import { BackBar, Stat, Mini } from "./ui";

export default function Profile({ user, stats, elo, matches, back }) {
  if (!stats) {
    return (
      <div className="fade">
        <BackBar back={back} title={user} />
        <p className="subtle">No games logged yet.</p>
      </div>
    );
  }

  const recent = matches
    .filter((m) => m.players.includes(user))
    .slice(-8)
    .reverse();

  const label = (m) => {
    if (m.gameType === "x01") return `${m.config.startScore}`;
    if (m.gameType === "baseball") return "Baseball";
    const v = m.config?.variant;
    return v === "cutthroat" ? "Cricket·Cut" : v === "noscore" ? "Cricket·NS" : "Cricket";
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="fade">
      <BackBar back={back} title={user} />

      <div className="grid-3 mb-12">
        <Stat label="Elo" value={Math.round(elo || 1500)} />
        <Stat label="Win %" value={stats.winPct.toFixed(0)} />
        <Stat label="Games" value={stats.games} />
      </div>

      <div className="card mb-12">
        <h3 className="section-title">X01</h3>
        <div className="grid-4">
          <Mini label="3-dart avg" value={stats.x01.threeDartAvg.toFixed(1)} />
          <Mini label="High turn" value={stats.x01.highestTurn} />
          <Mini label="Best leg" value={stats.x01.bestLeg ? `${stats.x01.bestLeg}d` : "—"} />
          <Mini label="High out" value={stats.x01.highestCheckout || "—"} />
        </div>
        <div className="tag" style={{ marginTop: 10 }}>
          {stats.x01.wins}-{stats.x01.games - stats.x01.wins} record
        </div>
      </div>

      <div className="card mb-12">
        <h3 className="section-title">Cricket</h3>
        <div className="grid-3">
          <Mini label="MPR" value={stats.cricket.mpr.toFixed(2)} />
          <Mini label="Win %" value={stats.cricket.winPct.toFixed(0)} />
          <Mini label="Games" value={stats.cricket.games} />
        </div>
      </div>

      <div className="card mb-12">
        <h3 className="section-title">Baseball</h3>
        <div className="grid-3">
          <Mini label="Avg runs" value={stats.baseball.avgRuns.toFixed(1)} />
          <Mini label="Win %" value={stats.baseball.winPct.toFixed(0)} />
          <Mini label="Games" value={stats.baseball.games} />
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Recent</h3>
        {recent.length === 0 && <span className="tag">none</span>}
        {recent.map((m, i) => (
          <div
            key={i}
            className="between"
            style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block" }}>
                {label(m)} vs {m.players.filter((p) => p !== user).join(", ") || "solo"}
              </span>
              <span className="tag" style={{ textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
                {fmtDate(m.completedAt)}
              </span>
            </span>
            <span style={{ color: m.winner === user ? "var(--accent)" : "var(--red)", fontWeight: 800, marginLeft: 12 }}>
              {m.winner === user ? "W" : "L"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
