import { PlayerBadge, TagPill } from "@/components/ui";

/** Big-screen end-of-game summary, rendered on /tv from the phone's payload. */
export default function TVSummary({ summary }) {
  if (!summary) return null;
  // one-player games carry an outcome ("Drill complete", "0 of 5 finishes")
  // in place of a winner: there is nobody to beat (lib/summary.js)
  const { winner, title, rows, highlights, durationMin, totalDarts, outcome = null } = summary;
  const winRow = rows.find((r) => r.isWinner) || rows[0];
  const meta = [];
  if (durationMin != null) meta.push(`${durationMin} min`);
  if (totalDarts) meta.push(`${totalDarts} dart${totalDarts === 1 ? "" : "s"}`);

  return (
    <div className="tv-board tv-summary">
      <div className="tv-header">
        <span>{title}</span>
        <span>Final{meta.length ? ` · ${meta.join(" · ")}` : ""}</span>
      </div>

      <div className="tv-summary-hero">
        <div className="tv-winner-label">{outcome ? outcome.kicker : "winner"}</div>
        <div className="tv-winner-name">
          <PlayerBadge username={winner} color={winRow?.color || undefined} size={72} showName={false} /> {winRow?.name || winner} <TagPill tag={winRow?.tag} tagIcon={winRow?.tagIcon} />
        </div>
        {outcome && <div className="tv-summary-elo">{outcome.headline}{outcome.best ? ` · ${outcome.best.text}` : ""}</div>}
        {winRow?.elo && (
          <div className="tv-summary-elo">
            {winRow.elo.before} → {winRow.elo.after}{" "}
            <span style={{ color: winRow.elo.delta >= 0 ? "var(--accent)" : "var(--red)" }}>
              {winRow.elo.delta >= 0 ? "▲" : "▼"} {Math.abs(winRow.elo.delta)}
            </span>
          </div>
        )}
      </div>

      <div className="tv-summary-grid" style={{ "--tv-players": Math.min(rows.length, 4) }}>
        {rows.map((r) => (
          <div key={r.u} className={`tv-x01-card ${r.isWinner ? "active" : ""}`}>
            <div className="tv-x01-name">
              <span className="tv-muted">{r.rank}</span> <PlayerBadge username={r.u} color={r.color || undefined} size={44} tag={r.tag || null} tagIcon={r.tagIcon || null} />
              {r.elo && (
                <span className="tv-summary-delta" style={{ color: r.elo.delta >= 0 ? "var(--accent)" : "var(--red)" }}>
                  {r.elo.delta >= 0 ? "▲" : "▼"}{Math.abs(r.elo.delta)}
                </span>
              )}
            </div>
            <div className="tv-summary-primary">{r.primary.value}</div>
            <div className="tv-x01-sub">{r.primary.label}</div>
            <div className="tv-summary-stats">
              {r.stats.map((s) => (
                <span key={s.label}>
                  <b>{s.value}</b> {s.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {highlights.length > 0 && (
        <div className="tv-summary-hl">
          {highlights.map((h, i) => (
            <div key={i} className="tv-summary-hl-item">
              <div className="tv-sub">{h.label}</div>
              <div className="tv-summary-hl-value">{h.value}</div>
              <div className="tv-summary-hl-player">{h.player}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
