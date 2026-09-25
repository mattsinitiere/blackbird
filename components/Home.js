import { useState, useMemo } from "react";
import { PlayerBadge, pressProps, UndoIcon, PlayIcon } from "./ui";

/** A solid play triangle for the main Start a Game button. */
function StartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.2-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" />
    </svg>
  );
}
import { BarChart } from "./Charts";
import WelcomeCard from "./WelcomeCard";
import MerlinCard from "./MerlinCard";
import { BASE_ELO } from "@/lib/constants";
import { gamesPerWeek } from "@/lib/stats";
import { lastGameFor, playAgainLabel } from "@/lib/playAgain";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 13; // ~3 months

function computeHighlights(results) {
  const cutoff = Date.now() - WEEKS * WEEK_MS;
  const recent = (results || []).filter((r) => new Date(r.completedAt).getTime() > cutoff);
  if (recent.length === 0) return null;

  const gameIds = new Set();
  const gamesBy = {};
  const winsBy = {};
  let bestTurn = null;
  let bestCheckout = null;
  let bestMpr = null;
  let bestAvg = null;

  for (const r of recent) {
    if (r.gameId) gameIds.add(r.gameId);
    gamesBy[r.username] = (gamesBy[r.username] || 0) + 1;
    if (r.result === "win") winsBy[r.username] = (winsBy[r.username] || 0) + 1;

    const s = r.stats || {};
    if (r.gameType === "x01") {
      if (s.highestTurn && (!bestTurn || s.highestTurn > bestTurn.val))
        bestTurn = { user: r.username, val: s.highestTurn };
      if (s.checkout && (!bestCheckout || s.checkout > bestCheckout.val))
        bestCheckout = { user: r.username, val: s.checkout };
      if (s.dartsThrown && s.pointsScored) {
        const avg = (s.pointsScored / s.dartsThrown) * 3;
        if (!bestAvg || avg > bestAvg.val)
          bestAvg = { user: r.username, val: Math.round(avg * 10) / 10 };
      }
    }
    if (r.gameType === "cricket" && s.rounds && s.marks) {
      const mpr = s.marks / s.rounds;
      if (!bestMpr || mpr > bestMpr.val)
        bestMpr = { user: r.username, val: Math.round(mpr * 100) / 100 };
    }
  }

  const mostActive = Object.entries(gamesBy).sort((a, b) => b[1] - a[1])[0];
  const topWinner = Object.entries(winsBy).sort((a, b) => b[1] - a[1])[0];

  const items = [];
  if (mostActive) items.push({ icon: "fire", label: "Most Active", player: mostActive[0], stat: `${mostActive[1]} games` });
  if (topWinner && topWinner[1] > 0) items.push({ icon: "trophy", label: "Most Wins", player: topWinner[0], stat: `${topWinner[1]} wins` });
  if (bestAvg) items.push({ icon: "target", label: "Best 3-Dart Avg", player: bestAvg.user, stat: String(bestAvg.val) });
  if (bestTurn) items.push({ icon: "zap", label: "Highest Turn", player: bestTurn.user, stat: String(bestTurn.val) });
  if (bestCheckout) items.push({ icon: "check", label: "Best Checkout", player: bestCheckout.user, stat: String(bestCheckout.val) });
  if (bestMpr) items.push({ icon: "marks", label: "Best Cricket MPR", player: bestMpr.user, stat: bestMpr.val.toFixed(2) });

  return items;
}

function PodiumIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="8" width="4" height="7" rx="0.5" />
      <rect x="6" y="4" width="4" height="11" rx="0.5" />
      <rect x="11" y="6" width="4" height="9" rx="0.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 3h9M5 8h9M5 13h9M2 3h0M2 8h0M2 13h0" />
    </svg>
  );
}

function HighlightIcon({ type }) {
  const props = { width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "fire") return <svg {...props}><path d="M9 1.5c0 3-3 4.5-3 7.5a4.5 4.5 0 009 0c0-3.5-3-5-3-7.5" /><path d="M9 16.5a2.25 2.25 0 002.25-2.25c0-1.5-2.25-2.25-2.25-4.5-0 2.25-2.25 3-2.25 4.5A2.25 2.25 0 009 16.5z" /></svg>;
  if (type === "trophy") return <svg {...props}><path d="M5 2h8v5a4 4 0 01-8 0V2z" /><path d="M5 4H3a1 1 0 00-1 1v1a3 3 0 003 3" /><path d="M13 4h2a1 1 0 011 1v1a3 3 0 01-3 3" /><path d="M7 11v2h4v-2M6 15h6M9 13v2" /></svg>;
  if (type === "target") return <svg {...props}><circle cx="9" cy="9" r="7" /><circle cx="9" cy="9" r="4" /><circle cx="9" cy="9" r="1" /></svg>;
  if (type === "zap") return <svg {...props}><path d="M10 1.5L4 10h5l-1 6.5 6-8.5h-5l1-6.5z" /></svg>;
  if (type === "check") return <svg {...props}><circle cx="9" cy="9" r="7" /><path d="M6 9l2 2 4-4" /></svg>;
  return <svg {...props}><circle cx="9" cy="9" r="7" /><path d="M6 6l6 6M12 6l-6 6" /></svg>;
}

export default function Home({ setView, openSetup, stats, elo, players, results, me, openProfile, playerColors, practice = [], social = null, following = [], userId = null, onPlayAgain = null, pendingCount = 0, onSyncNow = null, merlin = null, onMerlinAction = null }) {
  const visible = players.filter((p) => !p.hidden);
  // the signed-in player's own ranked games, one bar per week
  const weekly = useMemo(() => gamesPerWeek((results || []).filter((r) => r.username === me)), [results, me]);
  const [boardMode, setBoardMode] = useState("podium");
  const ranked = visible
    .map((p) => ({ u: p.username, elo: elo[p.username] || BASE_ELO, s: stats[p.username] }))
    .sort((a, b) => b.elo - a.elo);

  const highlights = useMemo(() => computeHighlights(results), [results]);
  const lastGame = useMemo(() => lastGameFor([...(results || []), ...(practice || [])], me), [results, practice, me]);

  const podiumOrder = ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2]] : ranked.slice(0, 3);
  const podiumHeights = [100, 140, 80];
  const podiumLabels = ["2nd", "1st", "3rd"];

  return (
    <div className="fade">
      <WelcomeCard
        me={me}
        userId={userId}
        elo={elo}
        stats={stats}
        results={results}
        practice={practice}
        social={social}
        following={following}
        playerColors={playerColors}
        onRematch={(opponent) => (openSetup ? openSetup({ players: [me, opponent] }) : setView("setup"))}
      />
      <div className="home-actions">
        <button className="btn btn-primary home-action" onClick={() => (openSetup ? openSetup(null) : setView("setup"))}>
          <StartIcon /> Start a Game
        </button>
        {lastGame && onPlayAgain && (
          <button className="btn home-action is-again" onClick={() => onPlayAgain(lastGame)}>
            <UndoIcon /> <span className="play-again-text">Play Again: {playAgainLabel(lastGame)}</span>
          </button>
        )}
        <button className="btn home-action is-practice" onClick={() => setView("practice")}>
          <PlayIcon size={18} /> Practice &amp; Bots
        </button>
      </div>
      {merlin && onMerlinAction && <MerlinCard card={merlin} onAction={onMerlinAction} />}
      {pendingCount > 0 && (
        <div className="sync-note" role="status">
          <span>
            {pendingCount} {pendingCount === 1 ? "game" : "games"} waiting to sync
          </span>
          {onSyncNow && (
            <button type="button" className="btn btn-sm" onClick={onSyncNow}>
              Sync Now
            </button>
          )}
        </div>
      )}

      <div className="card mb-12">
        <h3 className="section-title">Your Games · Last 3 Months</h3>
        <BarChart data={weekly} />
      </div>

      <hr className="sep" />
      <div className="between" style={{ marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Top of the Board</h2>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className={`btn ${boardMode === "podium" ? "btn-primary" : ""}`}
            style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            aria-pressed={boardMode === "podium"}
            onClick={() => setBoardMode("podium")}
            aria-label="Podium view"
            title="Podium"
          >
            <PodiumIcon />
          </button>
          <button
            className={`btn ${boardMode === "list" ? "btn-primary" : ""}`}
            style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            aria-pressed={boardMode === "list"}
            onClick={() => setBoardMode("list")}
            aria-label="List view"
            title="List"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {ranked.length === 0 && (
        <p className="subtle">No players yet. Start a game to add some.</p>
      )}

      {boardMode === "podium" && ranked.length >= 3 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, padding: "16px 0 0", borderBottom: "2px solid var(--line-strong)" }}>
            {podiumOrder.map((r, i) => {
              const h = podiumHeights[i];
              const isFirst = i === 1;
              return (
                <div
                  key={r.u}
                  className="podium-col"
                  {...pressProps(() => openProfile(r.u))}
                  aria-label={`${podiumLabels[i]}: ${r.u}, ${Math.round(r.elo)} Elo`}
                  style={{
                    flex: 1,
                    maxWidth: isFirst ? 160 : 130,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={isFirst ? 48 : 36} showName={false} />
                  <div style={{
                    fontWeight: 700,
                    fontSize: isFirst ? "calc(14px * var(--fs))" : "calc(12px * var(--fs))",
                    marginTop: 6,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}>
                    {r.u}
                  </div>
                  <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: "calc(16px * var(--fs))", marginTop: 2 }}>
                    {Math.round(r.elo)}
                  </div>
                  <div className="podium-bar" style={{
                    "--podium-h": `${h}px`,
                    width: "100%",
                    marginTop: 8,
                    borderRadius: "var(--radius) var(--radius) 0 0",
                    background: isFirst
                      ? "linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))"
                      : i === 0
                      ? "color-mix(in srgb, var(--accent) 34%, var(--surface))"
                      : "color-mix(in srgb, var(--accent) 18%, var(--surface))",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 10,
                  }}>
                    <span style={{
                      fontWeight: 700,
                      fontSize: "calc(14px * var(--fs))",
                      color: isFirst ? "var(--on-accent)" : "var(--ink-soft)",
                      letterSpacing: "0.04em",
                    }}>
                      {podiumLabels[i]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {ranked.length > 3 && (
            <div className="stack-8" style={{ marginTop: 12 }}>
              {ranked.slice(3).map((r, i) => (
                <div
                  key={r.u}
                  className="card pad-sm clickable"
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                  {...pressProps(() => openProfile(r.u))}
                >
                  <div className="num" style={{ fontSize: "calc(16px * var(--fs))", width: "calc(22px * var(--fs))", color: "var(--muted)" }}>
                    {i + 4}
                  </div>
                  <div style={{ flex: 1 }}>
                    <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={20} />
                    <div className="tag" style={{ marginTop: 2 }}>
                      {r.s ? `${r.s.wins}-${r.s.games - r.s.wins} · avg ${r.s.x01.threeDartAvg.toFixed(1)}` : "no games"}
                    </div>
                  </div>
                  <div className="num" style={{ fontSize: "calc(15px * var(--fs))", color: "var(--accent)" }}>
                    {Math.round(r.elo)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {boardMode === "list" && (
        <div className="stack-8">
          {ranked.map((r, i) => (
            <div
              key={r.u}
              className="card pad-sm clickable"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
              {...pressProps(() => openProfile(r.u))}
            >
              <div
                className="num"
                style={{ fontSize: "calc(20px * var(--fs))", width: "calc(24px * var(--fs))", color: i === 0 ? "var(--amber)" : "var(--muted)" }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={22} />
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
      )}

      {boardMode === "podium" && ranked.length > 0 && ranked.length < 3 && (
        <div className="stack-8">
          {ranked.map((r, i) => (
            <div
              key={r.u}
              className="card pad-sm clickable"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
              {...pressProps(() => openProfile(r.u))}
            >
              <div className="num" style={{ fontSize: "calc(20px * var(--fs))", width: "calc(24px * var(--fs))", color: i === 0 ? "var(--amber)" : "var(--muted)" }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <PlayerBadge username={r.u} color={playerColors?.[r.u]} size={22} />
              </div>
              <div className="num" style={{ fontSize: "calc(17px * var(--fs))", color: "var(--accent)" }}>
                {Math.round(r.elo)}
              </div>
            </div>
          ))}
        </div>
      )}

      {highlights && highlights.length > 0 && (
        <>
          <hr className="sep" />
          <h2 className="section-title">Highlights</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
            {highlights.map((h, i) => (
              <div
                key={i}
                className="card pad-sm"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  background: i === 0 ? "var(--accent-soft)" : undefined,
                  borderColor: i === 0 ? "var(--accent)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: i === 0 ? "var(--accent)" : "var(--muted)", display: "flex" }}>
                    <HighlightIcon type={h.icon} />
                  </span>
                  <span className="tag" style={{ color: i === 0 ? "var(--accent)" : undefined }}>{h.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="num" style={{ fontSize: "calc(22px * var(--fs))", color: i === 0 ? "var(--accent)" : "var(--ink)" }}>
                    {h.stat}
                  </span>
                </div>
                <div style={{ fontSize: "calc(13px * var(--fs))", fontWeight: 600, color: "var(--ink-soft)" }}>
                  {h.player}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
