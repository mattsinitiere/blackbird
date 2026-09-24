import { useState } from "react";
import { PlayerBadge } from "../ui";
import { playerLabel } from "@/lib/bots";
import { ChevronIcon } from "./icons";

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
    <article className="card pf-post" aria-label={`${m.title}, ${resultText(m)}, ${fmtWhen(m.date)}`}>
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

      <div className="pf-figures">
        {m.primary && (
          <div className="pf-figure pf-figure-main">
            <span className="num">{m.primary.value}</span>
            <span className="pf-figure-label">{m.primary.label}</span>
          </div>
        )}
        {m.figures.map((f) => (
          <div key={f.label} className="pf-figure">
            <span className="num">{f.value}</span>
            <span className="pf-figure-label">{f.label}</span>
          </div>
        ))}
        {m.eloDelta != null && m.eloDelta !== 0 && (
          <div className="pf-figure">
            <span className={`num ${m.eloDelta > 0 ? "pf-up" : "pf-down"}`}>
              {m.eloDelta > 0 ? "+" : "−"}
              {Math.abs(m.eloDelta)}
            </span>
            <span className="pf-figure-label">Elo</span>
          </div>
        )}
      </div>

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
          <button type="button" className="pf-link" onClick={() => openGame(m.row)}>
            Match details <ChevronIcon size="0.9em" />
          </button>
        </div>
      )}
    </article>
  );
}

function AchievementPost({ a, user, playerColors, isNew }) {
  const b = a.badge;
  return (
    <article className="card pf-post pf-post-badge" aria-label={`Unlocked ${b.title}, ${fmtDay(a.date)}`}>
      <header className="pf-post-head">
        <PlayerBadge username={user} color={playerColors?.[user]} size={36} showName={false} />
        <div className="pf-post-who">
          <div className="pf-post-name">
            {user} <span className="pf-post-verb">unlocked an achievement</span>
          </div>
          <time className="pf-post-time" dateTime={a.date}>{fmtDay(a.date)}</time>
        </div>
        {isNew && <span className="badge-new pf-badge-new">New</span>}
      </header>
      <div className="pf-badge-row">
        <span className="pf-badge-icon" aria-hidden="true">{b.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className="pf-post-title" style={{ margin: 0 }}>{b.title}</div>
          <div className="pf-post-note" style={{ margin: 0 }}>{b.description}</div>
        </div>
      </div>
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
  const list = filter === "matches" ? items.filter((i) => i.kind === "match") : items;
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
      {shown.map((it) =>
        it.kind === "match" ? (
          <MatchCard key={it.key} m={it} user={user} playerColors={playerColors} openGame={openGame} />
        ) : (
          <AchievementPost key={it.key} a={it} user={user} playerColors={playerColors} isNew={isMe && seen && !seen.has(it.badge.id)} />
        )
      )}
      {list.length > limit && (
        <button type="button" className="btn pf-more" onClick={() => setLimit((n) => n + PAGE)}>
          Show more ({list.length - limit} older)
        </button>
      )}
    </div>
  );
}
