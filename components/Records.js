import { useMemo } from "react";
import { BackBar, PlayerBadge, pressProps } from "./ui";
import { computeRecords } from "@/lib/gamestats/records";

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

/** League records for every game type, from the stats engine (lib/gamestats/records.js). */
export default function Records({ usernames, stats, results, practice = [], openGame, back, playerColors }) {
  const records = useMemo(() => computeRecords({ results, practice }), [results, practice]);

  return (
    <div className="fade">
      <BackBar back={back} title="Records" />

      {records.length === 0 && <p className="subtle">Play some games to see records here.</p>}

      <div className="stack-8">
        {records.map((r) => (
          <div
            key={r.id}
            className="card pad-sm"
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: openGame ? "pointer" : undefined }}
            {...(openGame ? pressProps(() => openGame({ gameId: r.gameId })) : {})}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "calc(14px * var(--fs))" }}>{r.title}</div>
              <div className="tag" style={{ marginTop: 2 }}><PlayerBadge username={r.holder} color={playerColors?.[r.holder]} size={18} /> · {fmt(r.date)}</div>
            </div>
            <div className="num" style={{ fontSize: "calc(20px * var(--fs))", color: "var(--accent)", flex: "none" }}>
              {r.display}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(stats).length > 0 && (
        <div className="card mt-12">
          <h3 className="section-title">Streaks</h3>
          <div className="stack-8">
            {usernames
              .filter((u) => stats[u] && stats[u].bestWinStreak > 0)
              .sort((a, b) => (stats[b].bestWinStreak || 0) - (stats[a].bestWinStreak || 0))
              .map((u) => (
                <div key={u} className="between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <PlayerBadge username={u} color={playerColors?.[u]} size={18} />
                  <span>
                    <span className="num" style={{ color: "var(--accent)", fontSize: "calc(15px * var(--fs))" }}>
                      {stats[u].bestWinStreak}
                    </span>
                    <span className="tag" style={{ marginLeft: 6 }}>best</span>
                    {stats[u].winStreak > 0 && (
                      <span className="tag" style={{ marginLeft: 8, color: "var(--amber)" }}>
                        {stats[u].winStreak} current
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
