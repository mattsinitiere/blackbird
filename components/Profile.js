import { useState, useEffect, useMemo } from "react";
import { BackBar, Stat, Mini, PlayerBadge } from "./ui";
import AchievementsCard from "./Achievements";
import { computeAchievements, readSeen, writeSeen, seenKey } from "@/lib/achievements";
import { LineChart } from "./Charts";
import PlayerCard from "./PlayerCard";
import { playerTimeline } from "@/lib/stats";
import { gameName } from "@/lib/summary";
import { playerLabel } from "@/lib/bots";
import { computePractice } from "@/lib/practice";

function FollowButton({ isFollowing, onFollow, onUnfollow }) {
  const [busy, setBusy] = useState(false);
  if (isFollowing == null) return null;
  const act = async () => {
    setBusy(true);
    try {
      await (isFollowing ? onUnfollow() : onFollow());
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`btn btn-sm ${isFollowing ? "" : "btn-primary"}`} style={{ flex: "none" }} onClick={act} disabled={busy} aria-pressed={isFollowing}>
      {busy ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}

function ProfileHeader({ user, player, playerColors, sub, follow }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PlayerBadge username={user} color={playerColors?.[user]} size={48} showName={false} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="display" style={{ fontSize: "calc(22px * var(--fs))", lineHeight: 1.1 }}>{user}</div>
          {player?.handle && (
            <div style={{ fontWeight: 700, fontSize: "calc(14px * var(--fs))", color: "var(--accent)", marginTop: 2 }}>
              @{player.handle}
            </div>
          )}
          {sub && (
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{sub}</div>
          )}
        </div>
        {follow && !follow.isMe && <FollowButton {...follow} />}
      </div>
      {(player?.bio || player?.location) && (
        <div style={{ marginTop: 10, paddingLeft: 60 }}>
          {player.bio && (
            <div style={{ fontSize: "calc(14px * var(--fs))", color: "var(--ink)", lineHeight: 1.4 }}>{player.bio}</div>
          )}
          {player.location && (
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <PinIcon /> {player.location}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function gameLabel(r) {
  if (r.gameType === "x01") return `${r.config.startScore}`;
  if (r.gameType === "baseball") return "Baseball";
  if (r.gameType === "aroundTheClock") return "Clock";
  if (r.gameType === "killer") return "Killer";
  if (r.gameType === "shanghai") return "Shanghai";
  if (r.gameType === "halveit") return "Halve It";
  if (r.gameType === "gotcha") return "Gotcha";
  if (r.gameType === "tictactoe") return "Tic-Tac-Toe";
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
function PracticeCard({ rows, me, onOpen }) {
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
      <h3 className="section-title">Practice</h3>
      <div className="grid-3" style={{ gap: 8 }}>
        {tiles.map((t) => (
          <Mini key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        {p.recent.slice(0, 5).map((r, i) => (
          <div key={i} className="between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: "calc(13px * var(--fs))" }}>
            <span>
              {gameLabel(r)}
              {(r.opponents || []).length > 0 && (
                <span className="tag" style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                  vs {(r.opponents || []).map(playerLabel).join(", ")}
                </span>
              )}
            </span>
            <span className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>{fmtDate(r.completedAt)}</span>
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

export default function Profile({ user, player, stats, elo, results, practice = [], onOpenPractice, onOpenAccount, back, playerColors, isMe, isFollowing, onFollow, onUnfollow, social = null, userId = null }) {
  const follow = { isMe: !!isMe, isFollowing, onFollow, onUnfollow };
  // badges are derived from the rows we can see; another player's follows
  // are private, so their social badges are left out
  const badges = useMemo(() => computeAchievements({ me: user, results, practice, social: isMe ? social : null }), [user, results, practice, isMe, social]);
  const [seen, setSeen] = useState(() => new Set());
  useEffect(() => {
    if (!isMe || typeof window === "undefined") return;
    const key = seenKey(userId);
    setSeen(readSeen(window.localStorage, key));
    // after a moment, everything unlocked counts as seen (the "New" chips show once)
    const t = setTimeout(() => writeSeen(window.localStorage, key, [...readSeen(window.localStorage, key), ...badges.filter((b) => b.unlocked).map((b) => b.id)]), 4000);
    return () => clearTimeout(t);
  }, [isMe, userId, badges]);
  const myPractice = practice.filter((r) => r.username === user);

  if (!stats) {
    return (
      <div className="fade">
        <BackBar back={back} />
        <ProfileHeader user={user} player={player} playerColors={playerColors} follow={follow} />
        {myPractice.length === 0 ? (
          <p className="subtle">No games logged yet.</p>
        ) : (
          <>
            <p className="subtle mb-12">No ranked games yet.</p>
            <PracticeCard rows={myPractice} me={user} onOpen={onOpenPractice} />
          </>
        )}
        <AchievementsCard badges={badges} isMe={!!isMe} seen={seen} />
      </div>
    );
  }

  const timeline = playerTimeline(results, user);
  const dartAvg = stats.x01.dartAvg || [0, 0, 0];

  const recent = results
    .filter((r) => r.username === user)
    .slice(-8)
    .reverse();

  // most recent cricket game with per-round marks (recorded from v1.2 on)
  const lastCricket = results
    .filter(
      (r) =>
        r.username === user &&
        r.gameType === "cricket" &&
        Array.isArray(r.stats?.roundMarks) &&
        r.stats.roundMarks.length > 0
    )
    .slice(-1)[0];

  const wins = stats.wins;
  const losses = stats.games - stats.wins;

  return (
    <div className="fade">
      <BackBar back={back} />

      <ProfileHeader
        user={user}
        player={player}
        playerColors={playerColors}
        follow={follow}
        sub={`${wins}-${losses} · ${stats.games} games · ${stats.winPct.toFixed(0)}% win`}
      />

      <PlayerCard user={user} handle={player?.handle} stats={stats} elo={elo} onOpenAccount={onOpenAccount} playerColors={playerColors} />

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

      {stats.x01.games > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">X01</h3>
        <div className="grid-4">
          <Mini label="3-dart avg" value={stats.x01.threeDartAvg.toFixed(1)} />
          <Mini label="High turn" value={stats.x01.highestTurn} />
          <Mini label="Best leg" value={stats.x01.bestLeg ? `${stats.x01.bestLeg}d` : "—"} />
          <Mini label="High out" value={stats.x01.highestCheckout || "—"} />
        </div>
        <div className="grid-3" style={{ marginTop: 8 }}>
          <Mini label="1st dart" value={dartAvg[0] ? dartAvg[0].toFixed(1) : "—"} />
          <Mini label="2nd dart" value={dartAvg[1] ? dartAvg[1].toFixed(1) : "—"} />
          <Mini label="3rd dart" value={dartAvg[2] ? dartAvg[2].toFixed(1) : "—"} />
        </div>
        <div className="tag" style={{ marginTop: 10 }}>
          {stats.x01.wins}-{stats.x01.games - stats.x01.wins} record
        </div>
      </div>
      )}

      {stats.cricket.games > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">Cricket</h3>
        <div className="grid-4">
          <Mini label="MPR" value={stats.cricket.mpr.toFixed(2)} />
          <Mini label="Best MPR" value={stats.cricket.bestMpr ? stats.cricket.bestMpr.toFixed(2) : "—"} />
          <Mini label="Win %" value={stats.cricket.winPct.toFixed(0)} />
          <Mini label="Games" value={stats.cricket.games} />
        </div>
        {lastCricket && (
          <div style={{ marginTop: 10 }}>
            <div className="tag" style={{ marginBottom: 6 }}>
              Last game · MPR {(lastCricket.stats.mpr ?? (lastCricket.stats.rounds ? lastCricket.stats.marks / lastCricket.stats.rounds : 0)).toFixed(2)} · marks by round
            </div>
            <div className="flex-wrap">
              {lastCricket.stats.roundMarks.map((m, i) => (
                <span key={i} className="chip" style={{ padding: "4px 9px", fontSize: "calc(12px * var(--fs))" }}>
                  R{i + 1}: {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {stats.x01.games > 0 && stats.x01.first9Avg > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">X01 Advanced</h3>
        <div className="grid-3">
          <Mini label="First 9 avg" value={stats.x01.first9Avg.toFixed(1)} />
          <Mini label="High out" value={stats.x01.highestCheckout || "—"} />
          <Mini label="High turn" value={stats.x01.highestTurn} />
        </div>
      </div>
      )}

      {stats.cricket.games > 0 && Object.keys(stats.cricket.perNumber || {}).length > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">Cricket Number Hits</h3>
        <div className="grid-4" style={{ gap: 6 }}>
          {["20", "19", "18", "17", "16", "15", "B"].map((k) => {
            const pn = (stats.cricket.perNumber || {})[k];
            if (!pn || !pn.darts) return null;
            const avg = (pn.hits / pn.darts).toFixed(2);
            return (
              <div key={k} style={{ textAlign: "center" }}>
                <div className="num" style={{ fontSize: "calc(16px * var(--fs))", color: "var(--accent)" }}>{avg}</div>
                <div className="tag">{k === "B" ? "Bull" : k}</div>
              </div>
            );
          })}
        </div>
        <div className="tag" style={{ marginTop: 6, textTransform: "none", letterSpacing: 0 }}>
          Average ring (1 single, 2 double, 3 treble) on the darts that landed in each number
          {stats.cricket.missPct != null && ` · ${Math.round(stats.cricket.missPct)}% of darts missed the scoring numbers over ${stats.cricket.loggedGames} logged game${stats.cricket.loggedGames === 1 ? "" : "s"}`}
        </div>
      </div>
      )}

      {stats.baseball.games > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">Baseball</h3>
        <div className="grid-3">
          <Mini label="Avg runs" value={stats.baseball.avgRuns.toFixed(1)} />
          <Mini label="Win %" value={stats.baseball.winPct.toFixed(0)} />
          <Mini label="Games" value={stats.baseball.games} />
        </div>
      </div>
      )}

      {(stats.aroundTheClock.games > 0 || stats.killer.games > 0 || stats.shanghai.games > 0 || stats.halveit.games > 0 || stats.gotcha.games > 0 || stats.tictactoe.games > 0) && (
      <div className="card mb-12">
        <h3 className="section-title">Other Games</h3>
        <div className="grid-3" style={{ gap: 8 }}>
          {stats.aroundTheClock.games > 0 && <Mini label="Clock" value={`${stats.aroundTheClock.wins}-${stats.aroundTheClock.games - stats.aroundTheClock.wins}`} />}
          {stats.killer.games > 0 && <Mini label="Killer" value={`${stats.killer.wins}-${stats.killer.games - stats.killer.wins}`} />}
          {stats.shanghai.games > 0 && <Mini label="Shanghai" value={`${stats.shanghai.wins}-${stats.shanghai.games - stats.shanghai.wins}`} />}
          {stats.halveit.games > 0 && <Mini label="Halve It" value={`${stats.halveit.wins}-${stats.halveit.games - stats.halveit.wins}`} />}
          {stats.gotcha.games > 0 && <Mini label="Gotcha" value={`${stats.gotcha.wins}-${stats.gotcha.games - stats.gotcha.wins}`} />}
          {stats.tictactoe.games > 0 && <Mini label="Tic-Tac-Toe" value={`${stats.tictactoe.wins}-${stats.tictactoe.games - stats.tictactoe.wins}`} />}
        </div>
      </div>
      )}

      {stats.bestWinStreak > 0 && (
      <div className="card mb-12">
        <h3 className="section-title">Streaks</h3>
        <div className="grid-3">
          <Mini label="Best streak" value={stats.bestWinStreak} />
          <Mini label="Current" value={stats.winStreak} />
          <Mini label="Form" value={stats.lastFive ? stats.lastFive.join("") : "—"} />
        </div>
      </div>
      )}

      <AchievementsCard badges={badges} isMe={!!isMe} seen={seen} />

      {myPractice.length > 0 && <PracticeCard rows={myPractice} me={user} onOpen={onOpenPractice} />}

      <div className="card">
        <h3 className="section-title">Recent</h3>
        {recent.length === 0 && <span className="tag">none</span>}
        {recent.map((r, i) => (
          <div
            key={i}
            className="between"
            style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: "calc(14px * var(--fs))" }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block" }}>
                {gameLabel(r)} vs {(r.opponents || []).length > 0 ? (r.opponents || []).map((opp, oi) => (
                  <span key={oi}>{oi > 0 && ", "}<PlayerBadge username={opp} color={playerColors?.[opp]} size={16} /></span>
                )) : "solo"}
              </span>
              <span className="tag" style={{ textTransform: "none", letterSpacing: 0, fontSize: "calc(11px * var(--fs-chrome))" }}>
                {fmtDate(r.completedAt)}
              </span>
            </span>
            <span style={{ color: r.result === "win" ? "var(--accent)" : "var(--red)", fontWeight: 700, marginLeft: 12 }}>
              {r.result === "win" ? "W" : "L"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
