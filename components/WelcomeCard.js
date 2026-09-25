import { useEffect, useMemo, useState } from "react";
import { PlayerBadge } from "./ui";
import BadgeMedal from "./BadgeMedal";
import BadgeDetail from "./BadgeDetail";
import { computeAchievements } from "@/lib/achievements";
import { greeting, welcomeInsights, pickInsight } from "@/lib/welcome";
import { currentStreak } from "@/lib/playAgain";
import { BASE_ELO } from "@/lib/constants";

/**
 * Home's welcome card: a greeting and one insight from the player's own
 * data. The insight changes between app opens (the last one shown is
 * remembered on this device) but stays put while you move around the app.
 * The last-visit time is also per device, per account.
 */
export default function WelcomeCard({ me, userId, elo, stats, results, practice, social, following, playerColors, onRematch }) {
  const [state, setState] = useState(null); // { prevVisit, lastKind, pickedKind }
  const [openBadge, setOpenBadge] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `bb-welcome:${userId || "anon"}`;
    let stored = {};
    try {
      stored = JSON.parse(window.localStorage.getItem(key) || "{}");
    } catch {}
    // once per app open: remember the previous visit and stamp this one
    let session = null;
    try {
      session = JSON.parse(window.sessionStorage.getItem(key) || "null");
    } catch {}
    if (!session) {
      session = { prevVisit: stored.lastVisit || null, lastKind: stored.lastKind || null, pickedKind: null };
      try {
        window.sessionStorage.setItem(key, JSON.stringify(session));
        window.localStorage.setItem(key, JSON.stringify({ ...stored, lastVisit: new Date().toISOString() }));
      } catch {}
    }
    setState({ ...session, key });
  }, [userId]);

  const badges = useMemo(() => computeAchievements({ me, results, practice, social }), [me, results, practice, social]);
  const insights = useMemo(
    () => (state ? welcomeInsights({ me, stats, results, badges, following, lastVisit: state.prevVisit }) : []),
    [state, me, stats, results, badges, following]
  );
  const insight = useMemo(() => {
    if (!state) return null;
    const keep = state.pickedKind && insights.find((i) => i.kind === state.pickedKind);
    return keep || pickInsight(insights, state.lastKind);
  }, [state, insights]);

  // remember the pick for this app open (stable) and for next time (rotate)
  useEffect(() => {
    if (!state || !insight || state.pickedKind === insight.kind) return;
    const next = { ...state, pickedKind: insight.kind };
    try {
      window.sessionStorage.setItem(state.key, JSON.stringify({ prevVisit: next.prevVisit, lastKind: next.lastKind, pickedKind: next.pickedKind }));
      const stored = JSON.parse(window.localStorage.getItem(state.key) || "{}");
      window.localStorage.setItem(state.key, JSON.stringify({ ...stored, lastKind: insight.kind }));
    } catch {}
    setState(next);
  }, [state, insight]);

  if (!me) return null;
  const mine = stats?.[me];
  const myElo = Math.round(elo?.[me] || BASE_ELO);
  const streak = currentStreak(mine?.lastFive);
  const now = new Date();
  const today = `${now.getDate()} ${now.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${now.getFullYear()}`;
  return (
    <section className="mb-12 welcome" aria-label="Welcome">
      <div className="welcome-top">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="welcome-date">{today}</div>
          <h2 className="welcome-hello">{greeting(me, new Date(), state?.prevVisit)}</h2>
        </div>
        <span className="welcome-avatar">
          <PlayerBadge username={me} color={playerColors?.[me]} size={52} showName={false} />
        </span>
      </div>
      <div className="welcome-stats">
        <div className="welcome-stat">
          <span className="welcome-stat-val num">{myElo}</span>
          <span className="welcome-stat-label">Elo</span>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-val num">{mine?.games ? `${mine.wins}–${mine.games - mine.wins}` : "0–0"}</span>
          <span className="welcome-stat-label">Record</span>
        </div>
        <div className="welcome-stat">
          <span className="welcome-stat-val num">{streak || "–"}</span>
          <span className="welcome-stat-label">Streak</span>
        </div>
      </div>
      {insight && (
        <div className={`welcome-insight is-${insight.kind}`}>
          {insight.kind === "badge" && (
            <button type="button" className="welcome-medal" onClick={() => setOpenBadge(insight.badge)} aria-label={`${insight.badge.title}. Details`}>
              <BadgeMedal badge={insight.badge} locked size={36} />
            </button>
          )}
          {insight.kind === "rival" && <PlayerBadge username={insight.opponent} color={playerColors?.[insight.opponent]} size={32} showName={false} />}
          {insight.form ? (
            <p className="welcome-text">
              Last {insight.form.length}:{" "}
              {insight.form.map((r, i) => (
                <span key={i} className={`welcome-form ${r === "W" ? "is-w" : "is-l"}`}>{r}</span>
              ))}
            </p>
          ) : (
            <p className="welcome-text">{insight.text}</p>
          )}
          {insight.kind === "rival" && onRematch && (
            <button type="button" className="btn btn-sm welcome-action" onClick={() => onRematch(insight.opponent)}>
              Rematch
            </button>
          )}
        </div>
      )}
      {openBadge && <BadgeDetail badge={openBadge} onClose={() => setOpenBadge(null)} />}
    </section>
  );
}
