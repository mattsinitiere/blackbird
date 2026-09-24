import { Stat, Mini, pressProps } from "../ui";
import { LineChart } from "../Charts";
import CareerCards from "../CareerCards";
import PlayerCard from "../PlayerCard";
import { gameName } from "@/lib/summary";
import { playerLabel } from "@/lib/bots";
import { computePractice } from "@/lib/practice";

function gameLabel(r) {
  if (r.gameType === "x01") return `${r.config.startScore}`;
  if (r.gameType === "cricket") {
    const v = r.config?.variant;
    return v === "cutthroat" ? "Cricket·Cut" : v === "noscore" ? "Cricket·NS" : "Cricket";
  }
  return gameName(r.gameType);
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

/** Practice section: solo games, bot games and drills. Never counted in stats. */
export function PracticeCard({ rows, me, onOpen, openGame, playerColors }) {
  const p = computePractice(rows, me);
  const tiles = [
    { label: "Sessions", value: p.count },
    { label: "This week", value: p.thisWeek },
    { label: "Bot level", value: p.bots.level },
  ];
  if (p.drills.bobs27.pb) tiles.push({ label: "Bob's 27 best", value: p.drills.bobs27.pb.value });
  if (p.drills.checkoutDrill.pb) tiles.push({ label: "Checkouts best", value: p.drills.checkoutDrill.pb.value });
  if (p.drills.scoringDrill.pb) tiles.push({ label: "Scoring best", value: p.drills.scoringDrill.pb.value.toFixed(1) });
  if (p.x01.bestAvg > 0) tiles.push({ label: "Solo X01 avg", value: p.x01.bestAvg.toFixed(1) });
  return (
    <div className="card mb-12">
      <div className="between" style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Practice</h3>
        <span className="tag">Not ranked</span>
      </div>
      <div className="grid-3" style={{ gap: 8 }}>
        {tiles.map((t) => (
          <Mini key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        {p.recent.slice(0, 5).map((r, i) => (
          <div
            key={i}
            className="between"
            style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: "calc(13px * var(--fs))", cursor: openGame ? "pointer" : undefined, gap: 8 }}
            {...(openGame && r.gameId ? pressProps(() => openGame(r)) : {})}
          >
            <span style={{ minWidth: 0 }}>
              {gameLabel(r)}
              {(r.opponents || []).length > 0 && (
                <span className="tag" style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                  vs {(r.opponents || []).map(playerLabel).join(", ")}
                </span>
              )}
            </span>
            <span className="tag" style={{ textTransform: "none", letterSpacing: 0, flex: "none" }}>{fmtDate(r.completedAt)}</span>
          </div>
        ))}
      </div>
      {onOpen && (
        <button className="btn mt-12" style={{ width: "100%" }} onClick={onOpen}>
          Practice hub: bots, drills &amp; trends
        </button>
      )}
    </div>
  );
}

/**
 * The Statistics tab: everything the profile page showed before the
 * redesign, in the same order: player card export, headline tiles, trend
 * charts, career cards per game mode, streaks and form, then practice.
 */
export default function ProfileStats({ user, player, stats, elo, timeline, career, practiceRows, onOpenPractice, openGame, playerColors, rivalryCard, empty }) {
  return (
    <>
      {rivalryCard}
      {stats ? (
        <>
          <PlayerCard user={user} handle={player?.handle} stats={stats} elo={elo} playerColors={playerColors} />
          <div className="between pf-stats-note">
            <span className="tag">All time · ranked games only</span>
            <span className="tag">
              {stats.wins}–{stats.games - stats.wins}
            </span>
          </div>
          <div className="grid-3 mb-12">
            <Stat label="Elo" value={Math.round(elo || 1000)} />
            <Stat label="Win %" value={stats.winPct.toFixed(0)} />
            <Stat label="Games" value={stats.games} />
          </div>

          <div className="charts-2col">
            <div className="card">
              <h3 className="section-title">Elo Over Time</h3>
              <LineChart data={timeline.elo} color="var(--accent)" />
            </div>
            {stats.x01.games > 0 && (
              <div className="card">
                <h3 className="section-title">3-Dart Average Over Time</h3>
                <LineChart data={timeline.avg} color="var(--accent)" decimals={1} />
              </div>
            )}
            <div className="card">
              <h3 className="section-title">Win % Over Time</h3>
              <LineChart data={timeline.win} color="var(--live)" unit="%" />
            </div>
            {stats.cricket.games > 0 && (
              <div className="card">
                <h3 className="section-title">Cricket MPR Over Time</h3>
                <LineChart data={timeline.mpr} color="var(--amber)" decimals={2} />
              </div>
            )}
          </div>
        </>
      ) : (
        empty
      )}

      <CareerCards career={career} />

      {stats && stats.bestWinStreak > 0 && (
        <div className="card mb-12">
          <h3 className="section-title">Streaks &amp; Form</h3>
          <div className="grid-3">
            <Mini label="Best streak" value={stats.bestWinStreak} />
            <Mini label="Current" value={stats.winStreak} />
            <Mini label="Form" value={stats.lastFive ? stats.lastFive.join("") : "—"} />
          </div>
        </div>
      )}

      {practiceRows.length > 0 && <PracticeCard rows={practiceRows} me={user} onOpen={onOpenPractice} openGame={openGame} playerColors={playerColors} />}
    </>
  );
}
