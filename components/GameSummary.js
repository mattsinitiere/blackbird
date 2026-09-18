import { useState } from "react";
import { PlayerBadge, UndoIcon } from "./ui";
import Celebration from "./Celebration";

function EloDelta({ elo, size = 12 }) {
  if (!elo) return null;
  const up = elo.delta >= 0;
  return (
    <span
      className="num"
      style={{ fontSize: `calc(${size}px * var(--fs))`, color: up ? "var(--accent)" : "var(--red)", whiteSpace: "nowrap" }}
      aria-label={`Elo ${elo.before} to ${elo.after}`}
    >
      {up ? "▲" : "▼"} {Math.abs(elo.delta)}
    </span>
  );
}

/**
 * End-of-game screen. Pure presentation of a summary from lib/summary.js;
 * the shell owns saving, rematch and navigation.
 */
export default function GameSummary({ summary, saveState, saveError, onRetrySave, onRematch, onNewGame, onDone, playerColors }) {
  const [celeb, setCeleb] = useState(true);
  if (!summary) return null;
  const { winner, title, rows, highlights, ranked, durationMin, totalDarts } = summary;
  const winRow = rows.find((r) => r.isWinner) || rows[0];
  const colorOf = (r) => playerColors?.[r.u] || r.color || undefined;

  const meta = [];
  if (durationMin != null) meta.push(`${durationMin} min`);
  if (totalDarts) meta.push(`${totalDarts} darts`);

  return (
    <div className="fade">
      {celeb && <Celebration type="win" label={`${winner} wins`} onDone={() => setCeleb(false)} />}

      <div className="card mb-12" style={{ textAlign: "center", borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
        <div className="tag" style={{ color: "var(--accent)" }}>Winner</div>
        <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 8px" }}>
          <PlayerBadge username={winner} color={colorOf(winRow)} size={64} showName={false} />
        </div>
        <div className="display" style={{ fontSize: "calc(28px * var(--fs))", lineHeight: 1.1 }}>{winner}</div>
        {winRow?.elo && (
          <div className="num" style={{ marginTop: 6, fontSize: "calc(15px * var(--fs))", color: "var(--ink-soft)" }}>
            {winRow.elo.before} → {winRow.elo.after}{" "}
            <EloDelta elo={winRow.elo} size={14} />
          </div>
        )}
        <div className="tag" style={{ marginTop: 10, textTransform: "none", letterSpacing: 0 }}>
          {title}
          {meta.length > 0 && ` · ${meta.join(" · ")}`}
        </div>
      </div>

      <SaveLine ranked={ranked} saveState={saveState} saveError={saveError} onRetry={onRetrySave} />

      <div className="stack-8 mb-12">
        {rows.map((r) => (
          <div
            key={r.u}
            className="card pad-sm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderColor: r.isWinner ? "var(--accent)" : undefined,
            }}
          >
            <div className="num" style={{ fontSize: "calc(18px * var(--fs))", width: "calc(22px * var(--fs))", color: r.isWinner ? "var(--amber)" : "var(--muted)", textAlign: "center" }}>
              {r.rank}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PlayerBadge username={r.u} color={colorOf(r)} size={22} />
                <EloDelta elo={r.elo} />
              </div>
              <div className="tag" style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
                {r.stats.map((s) => (
                  <span key={s.label}>
                    <span style={{ color: "var(--ink-soft)" }}>{s.value}</span> {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div className="num" style={{ fontSize: "calc(24px * var(--fs))", lineHeight: 1, color: r.isWinner ? "var(--accent)" : "var(--ink)" }}>
                {r.primary.value}
              </div>
              <div className="tag" style={{ marginTop: 2 }}>{r.primary.label}</div>
            </div>
          </div>
        ))}
      </div>

      {highlights.length > 0 && (
        <div className="card mb-12">
          <h3 className="section-title">Highlights</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: 8 }}>
            {highlights.map((h, i) => (
              <div key={i} className="mini" style={{ textAlign: "left", padding: "10px 12px" }}>
                <div className="tag">{h.label}</div>
                <div className="num" style={{ fontSize: "calc(20px * var(--fs))", color: "var(--accent)", marginTop: 2 }}>{h.value}</div>
                <div style={{ fontSize: "calc(13px * var(--fs))", fontWeight: 600, color: "var(--ink-soft)", marginTop: 2 }}>{h.player}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%", fontSize: "calc(16px * var(--fs))", padding: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={onRematch}>
        <UndoIcon /> Rematch
      </button>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onNewGame}>New Game</button>
        <button className="btn" style={{ flex: 1 }} onClick={onDone}>{ranked ? "View Standings" : "Done"}</button>
      </div>
    </div>
  );
}

function SaveLine({ ranked, saveState, saveError, onRetry }) {
  let text;
  let color = "var(--muted)";
  if (!ranked) text = "Practice game — not saved to stats.";
  else if (saveState === "saving") text = "Saving to stats…";
  else if (saveState === "saved") {
    text = "Saved to stats.";
    color = "var(--accent)";
  } else if (saveState === "error") {
    text = `Couldn't save: ${saveError || "network error"}`;
    color = "var(--red)";
  } else return null;
  return (
    <div className="between mb-12" style={{ padding: "0 4px" }}>
      <span className="tag" style={{ textTransform: "none", letterSpacing: 0, color }}>{text}</span>
      {saveState === "error" && ranked && (
        <button className="btn" style={{ padding: "6px 12px" }} onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
