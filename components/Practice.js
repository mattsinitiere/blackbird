import { useMemo } from "react";
import TrainingPlans from "./TrainingPlans";
import AlterEgoCard from "./AlterEgoCard";
import { buildProfile } from "@/lib/alterEgo";
import { BackBar, Mini, Stat, PlayerBadge, pressProps } from "./ui";
import { BarChart, LineChart } from "./Charts";
import { computePractice } from "@/lib/practice";
import { gamesPerWeek } from "@/lib/stats";
import { gameName } from "@/lib/summary";
import { playerLabel } from "@/lib/bots";

const DRILLS = [
  { type: "bobs27", name: "Bob's 27", blurb: "Doubles, D1 to the bull. Don't hit zero." },
  { type: "checkoutDrill", name: "Checkouts", blurb: "Random finishes, nine darts each." },
  { type: "scoringDrill", name: "Scoring", blurb: "Visits at one number. Pile it up." },
];

function TargetIcon({ size = "1.1em" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LockIcon({ size = "1.1em" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function practiceLabel(r) {
  if (r.gameType === "x01") return `${r.config?.startScore || "X01"}`;
  if (r.gameType === "cricket") return "Cricket";
  return gameName(r.gameType);
}

/**
 * Practice hub: the bot ladder, drill launchers and the personal practice
 * dashboard (weekly sessions, personal bests, trends, recent sessions).
 * Everything here comes from practice rows; nothing counts toward stats.
 */
export default function Practice({ practice, me, onStart, back, playerColors, openGame, onAskAI = null, myRows = [], plans = null, onRefreshPlans, onDeletePlan, onLaunchPlan, onStartGame, liveGame = null, focusPlan = null }) {
  const p = useMemo(() => computePractice(practice, me), [practice, me]);
  const alterEgoOk = useMemo(() => buildProfile(myRows, { me, window: "last10" }).ok, [myRows, me]);
  const weekly = useMemo(() => gamesPerWeek((practice || []).filter((r) => r.username === me)), [practice, me]);
  const pbTiles = [];
  for (const d of DRILLS) {
    const s = p.drills[d.type];
    if (s.pb) pbTiles.push({ label: `${d.name} best`, value: s.label === "per visit" ? s.pb.value.toFixed(1) : s.pb.value });
  }
  if (p.x01.bestAvg > 0) pbTiles.push({ label: "Solo X01 avg", value: p.x01.bestAvg.toFixed(1) });
  const trends = [
    { title: "Bob's 27 Score", data: p.drills.bobs27.series },
    { title: "Checkouts Hit", data: p.drills.checkoutDrill.series },
    { title: "Scoring Per Visit", data: p.drills.scoringDrill.series, decimals: 1 },
    { title: "Solo X01 3-Dart Avg", data: p.x01.series, decimals: 1 },
  ].filter((t) => t.data.length >= 2);

  return (
    <div className="fade">
      <BackBar back={back} title="Practice" />

      <div className="grid-3 mb-12">
        <Stat label="Sessions" value={p.count} />
        <Stat label="This week" value={p.thisWeek} />
        <Stat label="Bot level" value={p.bots.level} />
      </div>

      {plans && (
        <TrainingPlans
          state={plans}
          unlocked={p.bots.ladder.filter((l) => l.unlocked).map((l) => l.bot.id)}
          alterEgoOk={alterEgoOk}
          onRefresh={onRefreshPlans}
          onDelete={onDeletePlan}
          onLaunch={onLaunchPlan}
          liveGame={liveGame}
          focusPlan={focusPlan}
        />
      )}

      {onStartGame && <AlterEgoCard rows={myRows} me={me} onStartGame={onStartGame} />}

      <div className="card mb-12">
        <h3 className="section-title">Bot Ladder</h3>
        <p className="tag mb-12" style={{ textTransform: "none", letterSpacing: 0 }}>
          X01, Cricket or Baseball against a bot. Beat one to unlock the next. Never counts toward stats or Elo.
        </p>
        <div className="stack-8">
          {p.bots.ladder.map(({ bot, wins, losses, unlocked }, i) => (
            <div
              key={bot.id}
              className={`card pad-sm ${unlocked ? "clickable" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 10, opacity: unlocked ? 1 : 0.55 }}
              {...(unlocked ? pressProps(() => onStart({ gameType: "x01", bot: bot.id })) : {})}
              aria-disabled={!unlocked}
            >
              <PlayerBadge username={bot.id} color={bot.color} size={30} showName={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{bot.name}</span>
                  <span className="tag" style={{ letterSpacing: 0 }}>L{bot.level} · avg {bot.avg}</span>
                </div>
                <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>
                  {unlocked ? bot.blurb : `Beat ${p.bots.ladder[i - 1].bot.name} to unlock.`}
                </div>
              </div>
              {unlocked ? (
                <span className="num" style={{ fontSize: "calc(14px * var(--fs))", color: wins > 0 ? "var(--accent)" : "var(--muted)" }}>
                  {wins}-{losses}
                </span>
              ) : (
                <span style={{ color: "var(--muted)" }}><LockIcon /></span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-12">
        <h3 className="section-title">Drills</h3>
        <div className="stack-8">
          {DRILLS.map((d) => {
            const s = p.drills[d.type];
            return (
              <div key={d.type} className="card pad-sm clickable" style={{ display: "flex", alignItems: "center", gap: 10 }} {...pressProps(() => onStart({ gameType: d.type }))}>
                <span style={{ color: "var(--accent)" }}><TargetIcon size="1.4em" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{d.name}</div>
                  <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>{d.blurb}</div>
                </div>
                <span className="tag" style={{ letterSpacing: 0 }}>{s.count ? `${s.count}×` : "new"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mb-12">
        <h3 className="section-title">Practice Sessions · Last 3 Months</h3>
        <BarChart data={weekly} />
      </div>

      {pbTiles.length > 0 && (
        <div className="card mb-12">
          <h3 className="section-title">Personal Bests</h3>
          <div className="grid-3" style={{ gap: 8 }}>
            {pbTiles.map((t) => (
              <Mini key={t.label} label={t.label} value={t.value} />
            ))}
          </div>
        </div>
      )}

      {trends.length > 0 && (
        <div className="charts-2col">
          {trends.map((t, i) => (
            // an odd one out at the end fills the row instead of leaving a gap
            <div key={t.title} className={`card${i === trends.length - 1 && trends.length % 2 ? " is-wide" : ""}`}>
              <h3 className="section-title">{t.title}</h3>
              <LineChart data={t.data} decimals={t.decimals || 0} />
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Recent</h3>
        {p.recent.length === 0 && <span className="tag">No practice yet. Pick a drill or a bot above.</span>}
        {p.recent.map((r, i) => (
          <div
            key={i}
            className="between"
            style={{ padding: "8px 0", borderBottom: i < p.recent.length - 1 ? "1px solid var(--line)" : "none", fontSize: "calc(14px * var(--fs))", cursor: openGame ? "pointer" : undefined }}
            {...(openGame ? pressProps(() => openGame(r)) : {})}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block" }}>
                {practiceLabel(r)}
                {(r.opponents || []).length > 0 && (
                  <span className="tag" style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                    vs {(r.opponents || []).map(playerLabel).join(", ")}
                    {r.winner === r.username ? " · won" : " · lost"}
                  </span>
                )}
              </span>
              <span className="tag" style={{ textTransform: "none", letterSpacing: 0, fontSize: "calc(11px * var(--fs-chrome))" }}>{fmtDate(r.completedAt)}</span>
            </span>
            <span className="num" style={{ marginLeft: 12, color: "var(--ink-soft)" }}>{summaryValue(r)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function summaryValue(r) {
  const pp = r.stats || {};
  if (r.gameType === "bobs27") return pp.finalScore ?? "";
  if (r.gameType === "checkoutDrill") return pp.finishes ? `${pp.hit || 0}/${pp.finishes}` : "";
  if (r.gameType === "scoringDrill") return pp.total ?? "";
  if (r.gameType === "x01" && pp.dartsThrown) return ((pp.pointsScored / pp.dartsThrown) * 3).toFixed(1);
  if (r.gameType === "cricket" && pp.mpr != null) return pp.mpr.toFixed(2);
  if (r.gameType === "baseball") return pp.runs ?? "";
  return "";
}
