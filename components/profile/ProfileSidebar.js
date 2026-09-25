import { PlayerBadge, pressProps } from "../ui";
import { LineChart } from "../Charts";
import { ChevronIcon, ActionLink } from "./icons";
import { useState } from "react";
import BadgeMedal from "../BadgeMedal";
import BadgeDetail from "../BadgeDetail";

function SideCard({ title, meta, children, action }) {
  const id = `pf-side-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="card pf-side-card" aria-labelledby={id}>
      <div className="pf-side-head">
        <h2 className="pf-side-title" id={id}>{title}</h2>
        {meta && <span className="pf-period">{meta}</span>}
      </div>
      {children}
      {action}
    </section>
  );
}

const LinkButton = ActionLink;

/**
 * The three compact sidebar sections. Every figure is lifetime ranked,
 * and each section says so.
 */
export default function ProfileSidebar({ user, isMe, stats, elo, timeline, badges, circle, circleNote, playerColors, openProfile, onOpenFriends, setTab, unavailable }) {
  const [openBadge, setOpenBadge] = useState(null);
  const unlocked = (badges || []).filter((b) => b.unlocked).sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));
  const avg = stats?.x01?.darts > 0 ? stats.x01.threeDartAvg.toFixed(1) : "—";
  return (
    <>
      <SideCard title={isMe ? "Your Game" : `${user}'s Game`} meta={stats ? "All time · ranked" : null} action={stats && <LinkButton onClick={() => setTab("stats")}>All Statistics</LinkButton>}>
        {stats ? (
          <>
            <div className="pf-elo">
              <span className="num">{Math.round(elo || 1000)}</span>
              <span className="pf-figure-label">Elo rating</span>
            </div>
            {timeline?.elo?.length > 1 && (
              <div className="pf-spark" aria-label="Elo over time">
                <LineChart data={timeline.elo} color="var(--accent)" textScale={1.8} />
              </div>
            )}
            <dl className="pf-kv">
              <div>
                <dt>3-dart avg</dt>
                <dd className="num">{avg}</dd>
              </div>
              <div>
                <dt>Win rate</dt>
                <dd className="num">{stats.winPct.toFixed(0)}%</dd>
              </div>
              <div>
                <dt>Matches</dt>
                <dd className="num">{stats.games}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="pf-empty">{unavailable || "No ranked matches yet."}</p>
        )}
      </SideCard>

      <SideCard
        title="Trophy Cabinet"
        meta={badges?.length && !unavailable ? `${unlocked.length} / ${badges.length}` : null}
        action={badges?.length > 0 && !unavailable && <LinkButton onClick={() => setTab("achievements")}>All Achievements</LinkButton>}
      >
        {unlocked.length ? (
          <ul className="pf-trophies">
            {unlocked.slice(0, 6).map((b) => (
              <li key={b.id}>
                <button type="button" className="pf-trophy" onClick={() => setOpenBadge(b)} aria-label={`${b.title}. Details`}>
                  <BadgeMedal badge={b} size={40} className="pf-trophy-icon" />
                  <span className="pf-trophy-name">{b.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pf-empty">{unavailable || "No achievements unlocked yet."}</p>
        )}
      </SideCard>

      <SideCard
        title={isMe ? "Your Circle" : "Frequent Opponents"}
        meta={circle?.length ? `${circle.length}` : null}
        action={isMe && onOpenFriends && <LinkButton onClick={onOpenFriends}>Friends &amp; Followers</LinkButton>}
      >
        {circle?.length ? (
          <ul className="pf-circle">
            {circle.slice(0, 6).map((c) => (
              <li key={c.username}>
                <div className="pf-circle-row" {...(openProfile ? pressProps(() => openProfile(c.username)) : {})} aria-label={`Open ${c.username}'s profile`}>
                  <PlayerBadge username={c.username} color={playerColors?.[c.username]} size={34} showName={false} />
                  <div className="pf-circle-who">
                    <div className="pf-circle-name">{c.username}</div>
                    <div className="pf-circle-sub">
                      {c.games > 0
                        ? `${c.games} ranked ${c.games === 1 ? "match" : "matches"} · ${isMe ? "you" : user} ${c.wins}–${c.losses}`
                        : "No ranked matches together yet"}
                    </div>
                  </div>
                  <ChevronIcon />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pf-empty">{circleNote}</p>
        )}
      </SideCard>
      {openBadge && <BadgeDetail badge={openBadge} onClose={() => setOpenBadge(null)} />}
    </>
  );
}
