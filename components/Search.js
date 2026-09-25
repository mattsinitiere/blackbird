import { useEffect, useMemo, useRef, useState } from "react";
import { Overlay, PlayerBadge, SearchIcon } from "./ui";
import { searchAll } from "@/lib/search";
import { gameName, gameTitle } from "@/lib/summary";
import { playerLabel } from "@/lib/bots";

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
export default function Search({ players, results, me, playerColors, onClose, openProfile, openGame, openSetup }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    // Overlay mounts its content a render later, so focus once it's there
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const out = useMemo(() => searchAll({ query, players, results, me }), [query, players, results, me]);
  const go = (fn) => {
    onClose();
    fn();
  };
  const none = out.query && !out.players.length && !out.modes.length && !out.matches.length;

  const matchRow = (r) => {
    const opps = (r.opponents || []).map(playerLabel);
    const detail = gameTitle(r.gameType, r.config || {});
    return (
      <li key={r.gameId}>
        <button type="button" className="search-row" onClick={() => go(() => openGame(r))}>
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
              placeholder="Players, game modes, matches"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players, game modes and matches"
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
                    <button key={m.id} type="button" className="plan-chip" onClick={() => go(() => openSetup({ gameType: m.id }))}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </section>
              <Group title="Recent Matches" items={out.matches} render={matchRow} empty={<p className="search-empty">Your games will show up here once you've played.</p>} />
            </>
          ) : none ? (
            <p className="search-empty" role="status">
              No players, modes or matches match “{query.trim()}”.
            </p>
          ) : (
            <>
              <Group
                title="Players"
                items={out.players}
                render={(p) => (
                  <li key={p.username}>
                    <button type="button" className="search-row" onClick={() => go(() => openProfile(p.username))}>
                      <PlayerBadge username={p.username} color={playerColors?.[p.username]} size={34} showName={false} />
                      <span className="search-row-main">
                        <span className="search-row-title">{p.username}</span>
                        <span className="search-row-sub">{p.handle ? `@${p.handle} · ` : ""}{Math.round(p.elo)} Elo</span>
                      </span>
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
                      <span className="search-row-main">
                        <span className="search-row-title">{m.name}</span>
                        <span className="search-row-sub">{m.games ? `You've played ${m.games} game${m.games === 1 ? "" : "s"}` : "Not played yet"} · Tap to play</span>
                      </span>
                    </button>
                  </li>
                )}
              />
              <Group title="Matches" items={out.matches} render={matchRow} />
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}
