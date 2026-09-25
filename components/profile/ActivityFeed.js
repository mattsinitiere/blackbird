import { useState } from "react";
import { PlayerBadge } from "../ui";
import { playerLabel } from "@/lib/bots";
import { ActionLink } from "./icons";
import BadgeMedal from "../BadgeMedal";
import BadgeDetail from "../BadgeDetail";

const PAGE = 10;

export function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "Today", "Yesterday", or "Wed, Sep 17" (with the year when it isn't this year). */
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function resultText(m) {
  if (m.won) return m.players > 2 ? `Won · 1st of ${m.players}` : "Won";
  if (m.place && m.players > 2) return `${ordinal(m.place)} of ${m.players}`;
  return "Lost";
}

function MatchCard({ m, user, playerColors, openGame }) {
  const shown = m.opponents.slice(0, 4);
  const more = m.opponents.length - shown.length;
  return (
    <article className={`card pf-post ${m.won ? "is-win" : "is-loss"}`} aria-label={`${m.title}, ${resultText(m)}, ${fmtWhen(m.date)}`}>
      <header className="pf-post-head">
        <PlayerBadge username={user} color={playerColors?.[user]} size={36} showName={false} />
        <div className="pf-post-who">
          <div className="pf-post-name">{user}</div>
          <time className="pf-post-time" dateTime={m.date}>{fmtWhen(m.date)}</time>
        </div>
        <span className={`pf-result ${m.won ? "is-win" : "is-loss"}`}>{resultText(m)}</span>
      </header>

      <div className="pf-post-title">{m.title}</div>
      <div className="pf-post-vs">
        <span className="pf-post-vs-label">vs</span>
        {shown.map((o) => (
          <PlayerBadge key={o} username={o} color={playerColors?.[o]} size={20} showTag={false} />
        ))}
        {more > 0 && <span className="pf-post-more">+{more} more</span>}
      </div>
      {!m.won && m.winner && m.players > 2 && <div className="pf-post-note">{playerLabel(m.winner)} won</div>}

      <dl className="pf-figures">
        {[...(m.primary ? [m.primary] : []), ...m.figures].map((f) => (
          <div key={f.label} className="pf-figure">
            <dd className="num">{f.value}</dd>
            <dt className="pf-figure-label">{f.label}</dt>
          </div>
        ))}
        {m.eloDelta != null && m.eloDelta !== 0 && (
          <div className="pf-figure">
            <dd className={`num ${m.eloDelta > 0 ? "pf-up" : "pf-down"}`}>
              {m.eloDelta > 0 ? "+" : "−"}
              {Math.abs(m.eloDelta)}
            </dd>
            <dt className="pf-figure-label">Elo</dt>
          </div>
        )}
      </dl>

      {m.highlights.length > 0 && (
        <ul className="pf-highlights">
          {m.highlights.map((h) => (
            <li key={h.label}>
              {h.label} <strong>{h.value}</strong>
            </li>
          ))}
        </ul>
      )}

      {openGame && m.row.gameId && (
        <div className="pf-post-foot">
          <ActionLink onClick={() => openGame(m.row)}>Match Details</ActionLink>
        </div>
      )}
    </article>
  );
}

/** One card for the achievements unlocked on the same day. */
function AchievementPost({ group, user, playerColors, seen, isMe }) {
  const [open, setOpen] = useState(null);
  const first = group[0];
  const many = group.length > 1;
  return (
    <article className="card pf-post pf-post-badge is-badge" aria-label={`Unlocked ${group.map((a) => a.badge.title).join(", ")}, ${fmtDay(first.date)}`}>
      <header className="pf-post-head">
        <PlayerBadge username={user} color={playerColors?.[user]} size={36} showName={false} />
        <div className="pf-post-who">
          <div className="pf-post-name">
            {user} <span className="pf-post-verb">{many ? `unlocked ${group.length} achievements` : "unlocked an achievement"}</span>
          </div>
          <time className="pf-post-time" dateTime={first.date}>{fmtDay(first.date)}</time>
        </div>
      </header>
      <ul className="pf-badge-list">
        {group.map((a) => (
          <li key={a.key} className="pf-badge-row" role="button" tabIndex={0} onClick={() => setOpen(a.badge)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(a.badge))} aria-label={`${a.badge.title}. Details`}>
            <BadgeMedal badge={a.badge} size={48} className="pf-badge-icon" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pf-post-title" style={{ margin: 0 }}>{a.badge.title}</div>
              <div className="pf-post-note" style={{ margin: 0 }}>{a.badge.description}</div>
            </div>
            {isMe && seen && !seen.has(a.badge.id) && <span className="badge-new pf-badge-new">New</span>}
          </li>
        ))}
      </ul>
      {open && <BadgeDetail badge={open} onClose={() => setOpen(null)} />}
    </article>
  );
}

/**
 * The Activity tab: ranked matches and achievement unlocks, newest first,
 * with an All / Matches filter when both kinds are present.
 */
export default function ActivityFeed({ items, user, isMe, seen, playerColors, openGame, empty, lead }) {
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const hasMatches = items.some((i) => i.kind === "match");
  const hasBadges = items.some((i) => i.kind === "achievement");
  // achievements unlocked on the same day share one card
  const list = [];
  for (const it of filter === "matches" ? items.filter((i) => i.kind === "match") : items) {
    const prev = list[list.length - 1];
    if (it.kind === "achievement" && prev?.kind === "achievements" && dayLabel(prev.date) === dayLabel(it.date)) prev.group.push(it);
    else list.push(it.kind === "achievement" ? { kind: "achievements", key: it.key, date: it.date, group: [it] } : it);
  }
  const shown = list.slice(0, limit);

  return (
    <div className="pf-feed">
      {lead}
      {hasMatches && hasBadges && (
        <div className="pf-filters" role="group" aria-label="Filter activity">
          {[
            ["all", "All"],
            ["matches", "Matches"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="pf-filter"
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setLimit(PAGE);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && empty}
      {shown.map((it, i) => {
        const day = dayLabel(it.date);
        const newDay = i === 0 || dayLabel(shown[i - 1].date) !== day;
        return (
          <div key={it.key} className="pf-feed-item">
            {newDay && day && <h3 className="pf-day">{day}</h3>}
            {it.kind === "match" ? (
              <MatchCard m={it} user={user} playerColors={playerColors} openGame={openGame} />
            ) : (
              <AchievementPost group={it.group} user={user} playerColors={playerColors} seen={seen} isMe={isMe} />
            )}
          </div>
        );
      })}
      {list.length > limit && (
        <button type="button" className="btn pf-more" onClick={() => setLimit((n) => n + PAGE)}>
          Show more ({list.length - limit} older)
        </button>
      )}
    </div>
  );
}
