import { useEffect, useMemo, useRef, useState } from "react";
import { Overlay, PlayerBadge, SearchIcon } from "./ui";
import { searchAll } from "@/lib/search";
import { gameName, gameTitle } from "@/lib/summary";
import { playerLabel } from "@/lib/bots";
import { GOALS } from "@/lib/trainingPlans";
import { progressText } from "@/lib/achievements";
import BadgeDetail from "./BadgeDetail";

// one line-art icon per kind of result, so a row says what it is at a glance
const Svg = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const TYPE_ICONS = {
  player: (
    <Svg>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </Svg>
  ),
  mode: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </Svg>
  ),
  match: (
    <Svg>
      <path d="M3 21l3.2-3.2" />
      <path d="M6.2 17.8l4-4" strokeWidth="3.4" />
      <path d="M10.2 13.8l5.3-5.3" />
      <path d="M15.5 8.5l1-5 2.2 2.8z" fill="currentColor" />
      <path d="M15.5 8.5l5-1-2.8-2.2z" fill="currentColor" />
    </Svg>
  ),
  achievement: (
    <Svg>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5L7.5 22 12 19.5 16.5 22 15 14.5" />
      <path d="M12 6.5l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.2 1.8-.3z" />
    </Svg>
  ),
  plan: (
    <Svg>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  ),
};
const TYPE_NAMES = { player: "Player", mode: "Game mode", match: "Match", achievement: "Achievement", plan: "Training plan" };
function TypeIcon({ type }) {
  return (
    <span className={`search-type is-${type}`} title={TYPE_NAMES[type]}>
      {TYPE_ICONS[type]}
      <span className="sr-only">{TYPE_NAMES[type]}: </span>
    </span>
  );
}
const goalLabel = (id) => GOALS.find((g) => g.id === id)?.label || "Training";

const PER_GROUP = 5;
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};
const RESULT_LABEL = { win: "Won", loss: "Lost", practice: "Practice" };

function Group({ title, items, render, empty }) {
  const [all, setAll] = useState(false);
  if (!items.length) return empty || null;
  const shown = all ? items : items.slice(0, PER_GROUP);
  return (
    <section className="search-group" aria-label={title}>
      <div className="search-group-head">
        <h3 className="search-group-title">{title}</h3>
        {items.length > PER_GROUP && (
          <button type="button" className="search-more" onClick={() => setAll((v) => !v)}>
            {all ? "Show Less" : `Show All ${items.length}`}
          </button>
        )}
      </div>
      <ul className="search-list">{shown.map(render)}</ul>
    </section>
  );
}

/**
 * Home search: players, game modes and your previous matches, from data
 * already loaded (lib/search.js). Full-screen, social-app style.
 */
export default function Search({ players, results, me, playerColors, achievements = [], plans = [], onClose, openProfile, openGame, openSetup, openPlan }) {
  const [query, setQuery] = useState("");
  const [badge, setBadge] = useState(null);
  const inputRef = useRef(null);
  const badgeRef = useRef(null);
  badgeRef.current = badge;
  useEffect(() => {
    // Overlay mounts its content a render later, so focus once it's there
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e) => e.key === "Escape" && !badgeRef.current && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const out = useMemo(() => searchAll({ query, players, results, me, achievements, plans }), [query, players, results, me, achievements, plans]);
  const go = (fn) => {
    onClose();
    fn();
  };
  const none = out.query && !out.players.length && !out.modes.length && !out.matches.length && !out.achievements.length && !out.plans.length;

  const matchRow = (r) => {
    const opps = (r.opponents || []).map(playerLabel);
    const detail = gameTitle(r.gameType, r.config || {});
    return (
      <li key={r.gameId}>
        <button type="button" className="search-row" onClick={() => go(() => openGame(r))}>
          <TypeIcon type="match" />
          <span className="search-row-main">
            <span className="search-row-title">
              {gameName(r.gameType)}
              {opps.length ? ` vs ${opps.join(", ")}` : " · Solo"}
            </span>
            <span className="search-row-sub">
              {detail && detail !== gameName(r.gameType) ? `${detail} · ` : ""}
              {fmtDate(r.completedAt)}
            </span>
          </span>
          {RESULT_LABEL[r.result] && <span className={`search-pill is-${r.result}`}>{RESULT_LABEL[r.result]}</span>}
        </button>
      </li>
    );
  };

  return (
    <Overlay className="search-backdrop" label="Search">
      <div className="search-sheet" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()}>
        <div className="search-bar">
          <label className="search-field">
            <SearchIcon size={18} />
            <input
              ref={inputRef}
              type="search"
              className="search-input"
              placeholder="Players, games, badges, plans"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players, game modes, matches, achievements and plans"
              enterKeyHint="search"
              autoComplete="off"
              autoFocus
            />
          </label>
          <button type="button" className="search-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="search-body">
          {!out.query ? (
            <>
              <section className="search-group" aria-label="Game Modes">
                <h3 className="search-group-title">Game Modes</h3>
                <div className="search-chips">
                  {out.modes.map((m) => (
                    <button key={m.id} type="button" className="plan-chip search-chip" onClick={() => go(() => openSetup({ gameType: m.id }))}>
                      <span className="search-chip-icon">{TYPE_ICONS.mode}</span>
                      {m.name}
                    </button>
                  ))}
                </div>
              </section>
              <Group title="Recent Matches" items={out.matches} render={matchRow} empty={<p className="search-empty">Your games will show up here once you've played.</p>} />
            </>
          ) : none ? (
            <p className="search-empty" role="status">
              Nothing matches “{query.trim()}”. Try a player, a game mode, an opponent, a date, an achievement or a plan.
            </p>
          ) : (
            <>
              <Group
                title="Players"
                items={out.players}
                render={(p) => (
                  <li key={p.username}>
                    <button type="button" className="search-row" onClick={() => go(() => openProfile(p.username))}>
                      <TypeIcon type="player" />
                      <span className="search-row-main">
                        <span className="search-row-title">{p.username}</span>
                        <span className="search-row-sub">{p.handle ? `@${p.handle} · ` : ""}{Math.round(p.elo)} Elo</span>
                      </span>
                      <PlayerBadge username={p.username} color={playerColors?.[p.username]} size={30} showName={false} />
                    </button>
                  </li>
                )}
              />
              <Group
                title="Game Modes"
                items={out.modes}
                render={(m) => (
                  <li key={m.id}>
                    <button type="button" className="search-row" onClick={() => go(() => openSetup({ gameType: m.id }))}>
                      <TypeIcon type="mode" />
                      <span className="search-row-main">
                        <span className="search-row-title">{m.name}</span>
                        <span className="search-row-sub">{m.games ? `You've played ${m.games} game${m.games === 1 ? "" : "s"}` : "Not played yet"} · Tap to play</span>
                      </span>
                    </button>
                  </li>
                )}
              />
              <Group title="Matches" items={out.matches} render={matchRow} />
              <Group
                title="Achievements"
                items={out.achievements}
                render={(a) => (
                  <li key={a.id}>
                    <button type="button" className="search-row" onClick={() => setBadge(a)}>
                      <TypeIcon type="achievement" />
                      <span className="search-row-main">
                        <span className="search-row-title">{a.title}</span>
                        <span className="search-row-sub">{a.unlocked ? `Unlocked ${fmtDate(a.earnedAt)}` : progressText(a.progress, { short: true }) || a.description}</span>
                      </span>
                      <span className={`search-pill${a.unlocked ? " is-win" : ""}`}>{a.unlocked ? "Unlocked" : "Locked"}</span>
                    </button>
                  </li>
                )}
              />
              <Group
                title="Training Plans"
                items={out.plans}
                render={(p) => (
                  <li key={p.id}>
                    <button type="button" className="search-row" onClick={() => go(() => openPlan(p.id))}>
                      <TypeIcon type="plan" />
                      <span className="search-row-main">
                        <span className="search-row-title">{p.definition.title}</span>
                        <span className="search-row-sub">
                          {goalLabel(p.definition.goal)} · {p.definition.sessions?.length || 0} sessions
                        </span>
                      </span>
                    </button>
                  </li>
                )}
              />
            </>
          )}
        </div>
      </div>
      {badge && <BadgeDetail badge={badge} onClose={() => setBadge(null)} />}
    </Overlay>
  );
}
