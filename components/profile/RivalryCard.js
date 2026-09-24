import { gameName } from "@/lib/summary";

/**
 * You vs this player, from your own ranked rows: overall and per game mode.
 * Games a third player won are listed apart, never as a win or a loss.
 */
export default function RivalryCard({ user, rv }) {
  if (!rv || !rv.games) return null;
  const modes = Object.entries(rv.byGameType).sort((a, b) => b[1].games - a[1].games);
  return (
    <section className="card pf-rivalry" aria-labelledby="pf-rivalry-title">
      <div className="pf-side-head">
        <h2 className="pf-side-title" id="pf-rivalry-title">You vs {user}</h2>
        <span className="pf-period">All time · ranked</span>
      </div>
      <div className="pf-rivalry-score" aria-label={`You ${rv.wins}, ${user} ${rv.losses}`}>
        <span className="num">{rv.wins}</span>
        <span className="pf-rivalry-dash">–</span>
        <span className="num">{rv.losses}</span>
        <span className="pf-rivalry-who">you – {user}</span>
      </div>
      <div className="pf-rivalry-sub">
        {rv.games} {rv.games === 1 ? "game" : "games"}
        {rv.otherWinner > 0 && ` · ${rv.otherWinner} won by someone else`}
        {rv.streak && ` · ${rv.streak.result === "W" ? "you won" : `${user} won`} the last ${rv.streak.count === 1 ? "meeting" : `${rv.streak.count}`}`}
      </div>
      {modes.length > 1 && (
        <ul className="pf-rivalry-modes">
          {modes.map(([gt, m]) => (
            <li key={gt}>
              <span>{gameName(gt)}</span>
              <span className="num">
                {m.wins}–{m.losses}
                {m.otherWinner > 0 && <span className="pf-muted"> (+{m.otherWinner})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
