import { useEffect } from "react";
import { PlayerBadge, UndoIcon } from "./ui";
import { feedback } from "@/lib/feedback";
import MatchChart from "./MatchChart";
import BadgeMedal from "./BadgeMedal";
import BotAvatar from "./BotAvatar";
import { playerLabel, botFor } from "@/lib/bots";
import { tiebreakOutcome } from "@/lib/tiebreak";

// games whose win buzz has already played this session (coming back from
// the match report remounts this screen)
const CELEBRATED = new Set();

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
export default function GameSummary({ match = null, summary, saveState, saveError, onRetrySave, onRematch, rematchFirst = "", onChangeOrder = null, onNewGame, onDone, onOpenReport, playerColors, newBadges = [], bot = null, onChooseBot, onPlayBot, onPracticeHub, planStep = null }) {
  // a haptic / sound for the win, once per game (Settings → Accessibility)
  const gameKey = `${summary?.completedAt || ""}|${summary?.winner || ""}`;
  useEffect(() => {
    if (CELEBRATED.has(gameKey)) return;
    CELEBRATED.add(gameKey);
    feedback("big");
  }, [gameKey]);
  if (!summary) return null;
  const { winner, title, rows, highlights, ranked, durationMin, totalDarts, outcome = null } = summary;
  const winRow = rows.find((r) => r.isWinner) || rows[0];
  const winName = winRow?.name || winner;
  const colorOf = (r) => playerColors?.[r.u] || r.color || undefined;
  // Shanghai / Halve It level on points: say who won the tiebreak, and how
  const tiebreak = match?.perPlayer ? tiebreakOutcome(match.perPlayer, winner) : null;

  const meta = [];
  if (durationMin != null) meta.push(`${durationMin} min`);
  if (totalDarts) meta.push(`${totalDarts} darts`);

  // the next step sits in a bar pinned above the nav (it settles at the end
  // of the page once you scroll there), so Rematch / Next is always one tap
  const unlocked = bot?.unlocked || null;
  const botName = bot ? botFor(bot.id)?.name || playerLabel(bot.id) : "";
  const rematch = {
    label: bot ? `Rematch ${botName}` : outcome ? "Play Again" : "Rematch",
    sub: rematchFirst,
    onClick: onRematch,
  };
  let primary;
  let secondary;
  if (planStep?.onNext) {
    primary = { label: planStep.nextLabel, onClick: planStep.onNext };
    secondary = rematch;
  } else if (planStep) {
    primary = planStep.onViewPlan ? { label: "View Plan", onClick: planStep.onViewPlan } : rematch;
    secondary = { label: ranked ? "View Standings" : "Done", onClick: onDone };
  } else if (unlocked && onPlayBot) {
    primary = { label: `Play ${unlocked.name}`, onClick: () => onPlayBot(unlocked.id) };
    secondary = rematch;
  } else if (bot) {
    primary = rematch;
    secondary = onChooseBot ? { label: "Choose Opponent", onClick: onChooseBot } : null;
  } else {
    primary = rematch;
    secondary = { label: "New Game", onClick: onNewGame };
  }

  return (
    <div className="fade">

      {outcome ? (
        <div className="card mb-12 summary-hero">
          <div className="tag" style={{ color: "var(--accent)" }}>{outcome.kicker}</div>
          <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 6px" }}>
            <PlayerBadge username={winner} color={colorOf(winRow)} size={48} showName={false} />
          </div>
          <div className="display summary-hero-headline">{outcome.headline}</div>
          <div className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
            {title}
            {meta.length > 0 && ` · ${meta.join(" · ")}`}
          </div>
          {outcome.best && <div className={`summary-best${outcome.best.isBest ? " is-best" : ""}`}>{outcome.best.text}</div>}
        </div>
      ) : (
        <div className="card mb-12 summary-hero">
          <div className="tag" style={{ color: "var(--accent)" }}>Winner</div>
          <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 8px" }}>
            <PlayerBadge username={winner} color={colorOf(winRow)} size={64} showName={false} />
          </div>
          <div className="display" style={{ fontSize: "calc(28px * var(--fs))", lineHeight: 1.1 }}>{winName}</div>
          {tiebreak && <div className="summary-tiebreak">Level on points, {tiebreak.text}</div>}
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
      )}

      {/* the payoffs of this game come straight after the result */}
      {unlocked && (
        <div className="card mb-12 bot-unlock">
          <BotAvatar bot={unlocked} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tag" style={{ color: "var(--live)" }}>New Opponent Unlocked</div>
            <div className="bot-unlock-name">{unlocked.name}</div>
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>
              Level {unlocked.level} · {unlocked.avg} average. {unlocked.blurb}
            </div>
          </div>
        </div>
      )}
      {planStep && <PlanStep step={planStep} />}

      {newBadges.length > 0 && (
        <div className="card mb-12 badge-unlocked" style={{ borderColor: "var(--amber)" }}>
          <div className="tag" style={{ color: "var(--amber)", marginBottom: 8 }}>Badge unlocked</div>
          <div className="stack-8">
            {newBadges.map((b) => (
              <div key={`${b.username}-${b.badge.id}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <BadgeMedal badge={b.badge} size={44} className="badge-icon" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{b.badge.title}</div>
                  <div className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>
                    {b.badge.description} · {b.username}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {tiebreak?.byPlayer[r.u] && (
                  <span className="summary-tiebreak-stat">
                    {r.u === tiebreak.winner ? "won tiebreak" : "tiebreak"} <span>{tiebreak.byPlayer[r.u]}</span>
                  </span>
                )}
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

      {match && <MatchChart match={match} playerColors={playerColors} />}

      {onOpenReport && (
        <button className="btn mb-12" style={{ width: "100%" }} onClick={onOpenReport}>
          Match Report
        </button>
      )}

      {/* the rest of the ways on, below the stats */}
      <div className="summary-more">
        {onChangeOrder && !planStep && (
          <button type="button" className="btn" onClick={onChangeOrder}>Change Order</button>
        )}
        {(planStep?.onNext || unlocked) && secondary !== rematch && (
          <button type="button" className="btn" onClick={onRematch}>{rematch.label}</button>
        )}
        {planStep?.onNext && planStep.onViewPlan && (
          <button type="button" className="btn" onClick={planStep.onViewPlan}>View Plan</button>
        )}
        {bot && onChooseBot && secondary?.label !== "Choose Opponent" && (
          <button type="button" className="btn" onClick={onChooseBot}>Choose Opponent</button>
        )}
        {bot && onPracticeHub && (
          <button type="button" className="btn" onClick={onPracticeHub}>Practice Hub</button>
        )}
        {!bot && secondary?.label !== "New Game" && onNewGame && (
          <button type="button" className="btn" onClick={onNewGame}>New Game</button>
        )}
        {!bot && secondary?.onClick !== onDone && onDone && (
          <button type="button" className="btn" onClick={onDone}>{ranked ? "View Standings" : "Done"}</button>
        )}
      </div>

      <div className="summary-bar" role="group" aria-label="Next">
        <button type="button" className="btn btn-primary summary-bar-main" onClick={primary.onClick}>
          {primary === rematch && <UndoIcon />}
          <span className="summary-bar-text">
            <span>{primary.label}</span>
            {primary.sub && <span className="summary-bar-sub">{primary.sub}</span>}
          </span>
        </button>
        {secondary && (
          <button type="button" className="btn summary-bar-alt" onClick={secondary.onClick}>
            <span className="summary-bar-text">
              <span>{secondary.label}</span>
              {secondary.sub && <span className="summary-bar-sub">{secondary.sub}</span>}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function SaveLine({ ranked, saveState, saveError, onRetry }) {
  const where = ranked ? "stats" : "your practice log";
  let text;
  let color = "var(--muted)";
  if (saveState === "saving") text = `Saving to ${where}…`;
  else if (saveState === "saved") {
    text = ranked ? "Saved to stats." : "Saved to your practice log — not counted in stats.";
    color = "var(--accent)";
  } else if (saveState === "queued") {
    text = saveError
      ? `Couldn't reach the server (${saveError}). Saved on this phone; it will sync automatically.`
      : "Saved on this phone. It will sync when you're back online.";
    color = "var(--amber)";
  } else if (saveState === "error") {
    text = `Couldn't save: ${saveError || "network error"}`;
    color = "var(--red)";
  } else if (!ranked) text = "Practice game — not counted in stats.";
  else return null;
  return (
    <div className="mb-12" style={{ padding: "0 4px", display: "flex", alignItems: "center", gap: 10 }}>
      <span className="tag" style={{ textTransform: "none", letterSpacing: 0, color, flex: 1, minWidth: 0 }}>{text}</span>
      {(saveState === "error" || saveState === "queued") && (
        <button className="btn" style={{ padding: "6px 12px", flex: "none" }} onClick={onRetry}>{saveState === "queued" ? "Sync Now" : "Retry"}</button>
      )}
    </div>
  );
}

/**
 * After a game that was part of a training plan: where the session stands
 * and the next drill, right under the result. Its buttons live in the
 * pinned bar (Next is the main one). Counts come from saved progress
 * (lib/trainingPlans.js).
 */
function PlanStep({ step }) {
  return (
    <section className="card mb-12 plan-step" aria-label="Training plan">
      <div className="plan-step-kicker">Training Plan · {step.planTitle}</div>
      <div className="plan-step-title">{step.headline}</div>
      {step.nextLabel && <p className="plan-step-note">{step.nextLabel}</p>}
      {step.note && <p className="plan-step-note">{step.note}</p>}
    </section>
  );
}
