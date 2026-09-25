import { useMemo, useState, useEffect, useRef } from "react";
import { BackBar, PlayerBadge, Overlay, isLight } from "./ui";
import { rivalry } from "@/lib/stats";
import { gameName } from "@/lib/summary";
import { BASE_ELO, defaultPlayerColor } from "@/lib/constants";
import { winChance, defaultRival, tapeRows } from "@/lib/matchup";

const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Compare two players: an avatar VS picker (you vs your most-played rival
 * by default), the Elo prediction, then either the tale of the tape or the
 * full head-to-head record. Sized to fit one phone screen per tab.
 */
export default function Matchup({ usernames, me, elo, results, stats, playerColors, openGame, openSetup, onAskAI = null }) {
  const pool = usernames || [];
  const [pickA, setA] = useState(null);
  const [pickB, setB] = useState(null);
  const [tab, setTab] = useState("tape");
  const [picking, setPicking] = useState(null); // "a" | "b" | null
  const [openRow, setOpenRow] = useState(null); // tape row showing its split

  // defaults are derived, so they settle once data loads
  const a = pickA && pool.includes(pickA) ? pickA : pool.includes(me) ? me : pool[0];
  const fallbackB = useMemo(() => defaultRival(results, a, pool), [results, a, pool]);
  const b = pickB && pool.includes(pickB) && pickB !== a ? pickB : fallbackB;

  const colorOf = (u) => playerColors?.[u] || defaultPlayerColor(u);
  const eloOf = (u) => Math.round(elo?.[u] || BASE_ELO);

  const rv = useMemo(() => (a && b ? rivalry(results, a, b) : null), [results, a, b]);
  const tape = useMemo(() => (a && b ? tapeRows(stats?.[a], stats?.[b], eloOf(a), eloOf(b)) : []), [stats, elo, a, b]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pool.length < 2 || !a || !b) {
    return (
      <div className="fade">
        <BackBar title="Matchup" />
        <div className="card mu-empty">
          <p style={{ margin: 0, fontWeight: 700 }}>Follow someone to compare</p>
          <p className="subtle" style={{ margin: "4px 0 0" }}>Matchup needs at least two players in your circle.</p>
        </div>
      </div>
    );
  }

  const pA = winChance(eloOf(a), eloOf(b));
  const swap = () => {
    setA(b);
    setB(a);
  };
  const choose = (u) => {
    if (picking === "a") setA(u);
    else setB(u);
    setPicking(null);
  };

  return (
    <div className="fade mu">
      <h1 className="sr-only">Matchup</h1>

      <section className="card mu-head" aria-label="Players">
        <Slot u={a} color={colorOf(a)} elo={eloOf(a)} onPick={() => setPicking("a")} />
        <div className="mu-vs">
          <span className="mu-vs-text">VS</span>
          <button type="button" className="mu-swap" onClick={swap} aria-label="Swap sides">
            <SwapIcon />
          </button>
        </div>
        <Slot u={b} color={colorOf(b)} elo={eloOf(b)} onPick={() => setPicking("b")} />

        <div className="mu-odds" aria-label={`Predicted: ${a} ${Math.round(pA * 100)} percent, ${b} ${Math.round((1 - pA) * 100)} percent`}>
          <span className="mu-odds-val num">{Math.round(pA * 100)}%</span>
          <div className="mu-odds-bar">
            <i style={{ width: `${pA * 100}%`, background: colorOf(a) }} />
            <i style={{ width: `${(1 - pA) * 100}%`, background: colorOf(b) }} />
          </div>
          <span className="mu-odds-val num">{Math.round((1 - pA) * 100)}%</span>
        </div>
        <div className="mu-odds-note">Win chance from Elo</div>
      </section>

      <div className="seg mu-tabs" role="tablist" aria-label="Matchup views">
        <button type="button" role="tab" aria-selected={tab === "tape"} className="seg-btn" onClick={() => setTab("tape")}>
          Tale of the Tape
        </button>
        <button type="button" role="tab" aria-selected={tab === "rivalry"} className="seg-btn" onClick={() => setTab("rivalry")}>
          Rivalry{rv?.games ? ` · ${rv.games}` : ""}
        </button>
      </div>

      {tab === "tape" ? (
        <section className={`card mu-card mu-tape${openRow ? " has-open" : ""}`} aria-label="Tale of the tape" style={{ "--rows": tape.length + ((stats?.[a]?.lastFive?.length > 0 || stats?.[b]?.lastFive?.length > 0) ? 1 : 0) }}>
          {tape.map((r) => (
            <TapeRow key={r.key} row={r} nameA={a} nameB={b} colA={colorOf(a)} colB={colorOf(b)} open={openRow === r.key} onOpen={(on) => setOpenRow(on ? r.key : null)} />
          ))}
          {(stats?.[a]?.lastFive?.length > 0 || stats?.[b]?.lastFive?.length > 0) && (
            <div className="mu-row">
              <Pips list={stats?.[a]?.lastFive} align="start" />
              <div className="mu-mid">
                <span className="mu-label">Last 5</span>
              </div>
              <Pips list={stats?.[b]?.lastFive} align="end" />
            </div>
          )}
        </section>
      ) : (
        <Rivalry rv={rv} a={a} b={b} colorOf={colorOf} openGame={openGame} />
      )}

      {(openSetup || onAskAI) && (
        <div className="mu-play-row">
          {onAskAI && (
            <button type="button" className="btn mu-scout" onClick={() => onAskAI(a === me ? `Scout my matchup against ${b}: who's favoured, what decides it, and what should I focus on?` : `Preview ${a} vs ${b}: who's favoured and what decides it?`)}>
              Scout with AI
            </button>
          )}
          {openSetup && (
            <button type="button" className="btn btn-primary mu-play" onClick={() => openSetup({ players: [a, b] })}>
              Play This Matchup
            </button>
          )}
        </div>
      )}

      {picking && (
        <PickerSheet
          pool={pool}
          current={picking === "a" ? a : b}
          disabled={picking === "a" ? b : a}
          colorOf={colorOf}
          eloOf={eloOf}
          onChoose={choose}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function Slot({ u, color, elo, onPick }) {
  return (
    <button type="button" className="mu-slot" onClick={onPick} aria-label={`${u}, Elo ${elo}. Change player`}>
      <span className="mu-slot-av" style={{ boxShadow: `0 0 0 3px var(--surface), 0 0 0 5px ${color}` }}>
        <PlayerBadge username={u} color={color} sizeCss="calc(52px * var(--fs-chrome))" showName={false} />
      </span>
      <span className="mu-slot-name">{u}</span>
      <span className="mu-slot-meta num">
        {elo} <span className="mu-slot-change">Change</span>
      </span>
    </button>
  );
}

function fg(color) {
  return /^#[0-9a-f]{6}$/i.test(color) && isLight(color) ? "#222" : "#fff";
}

const GAP_DIGITS = { avg: 1, runs: 1, mpr: 2 };

/** One tale-of-the-tape row; hover or tap the bar to read the split. */
function TapeRow({ row, nameA, nameB, colA, colB, open, onOpen }) {
  const total = row.av + row.bv;
  const share = total > 0 ? (row.av / total) * 100 : 50;
  const pill = (side, col) => (row.better === side ? { background: col, color: fg(col) } : undefined);
  const pa = Math.round(share);
  const gap = Math.abs(row.av - row.bv);
  const d = GAP_DIGITS[row.key] || 0;
  const gapText = row.better ? `${row.better === "a" ? nameA : nameB} +${gap.toFixed(d)}${row.key === "winPct" ? " pts" : ""}` : "Even";
  const hover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;
  return (
    <div className="mu-row">
      <span className={`mu-val num ${row.better === "a" ? "is-better" : ""}`} style={pill("a", colA)}>{row.a}</span>
      <button
        type="button"
        className={`mu-mid mu-mid-btn${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-label={`${row.label}: ${nameA} ${row.a}, ${nameB} ${row.b}. Show split`}
        onClick={() => onOpen(!open)}
        onMouseEnter={hover ? () => onOpen(true) : undefined}
        onMouseLeave={hover ? () => onOpen(false) : undefined}
      >
        <span className="mu-label">{row.label}</span>
        <span className="mu-gap" aria-hidden="true">
          <i style={{ width: `${share}%`, background: colA, opacity: row.better === "b" ? 0.35 : 1 }} />
          <i style={{ width: `${100 - share}%`, background: colB, opacity: row.better === "a" ? 0.35 : 1 }} />
        </span>
        {open && (
          <span className="mu-split" role="status">
            <b style={{ color: "var(--ink)" }}>{pa}%</b>
            <span>·</span>
            <b style={{ color: "var(--ink)" }}>{100 - pa}%</b>
            <span className="mu-split-gap">{gapText}</span>
          </span>
        )}
      </button>
      <span className={`mu-val num is-b ${row.better === "b" ? "is-better" : ""}`} style={pill("b", colB)}>{row.b}</span>
    </div>
  );
}

function Pips({ list, align }) {
  const l = list || [];
  return (
    <span className={`mu-pips is-${align}`}>
      {l.length ? l.map((r, i) => <span key={i} className={`mu-pip ${r === "W" ? "is-w" : "is-l"}`}>{r}</span>) : <span className="mu-val">–</span>}
    </span>
  );
}

function Rivalry({ rv, a, b, colorOf, openGame }) {
  if (!rv || !rv.games) {
    return (
      <section className="card mu-card mu-empty">
        <p style={{ margin: 0, fontWeight: 700 }}>No games between you yet</p>
        <p className="subtle" style={{ margin: "4px 0 0" }}>The prediction above is Elo only. Play one to start the record.</p>
      </section>
    );
  }
  const modes = Object.entries(rv.byGameType).sort((x, y) => y[1].games - x[1].games);
  const leader = rv.wins > rv.losses ? a : rv.losses > rv.wins ? b : null;
  const streakName = rv.streak ? (rv.streak.result === "W" ? a : b) : null;
  return (
    <section className="card mu-card" aria-label="Rivalry">
      <div className="mu-score">
        <span className="mu-score-n num" style={{ color: leader === a ? colorOf(a) : undefined }}>{rv.wins}</span>
        <span className="mu-score-dash">–</span>
        <span className="mu-score-n num" style={{ color: leader === b ? colorOf(b) : undefined }}>{rv.losses}</span>
      </div>
      <div className="mu-score-note">
        {rv.games} {rv.games === 1 ? "game" : "games"} since {shortDate(rv.firstPlayed)}
        {rv.otherWinner ? ` · ${rv.otherWinner} won by someone else` : ""}
        {rv.streak && rv.streak.count >= 2 ? ` · ${streakName} has won ${rv.streak.count} straight` : ""}
      </div>

      {modes.length > 0 && (
        <div className="mu-modes">
          {modes.map(([t, m]) => (
            <span key={t} className="mu-mode">
              {gameName(t)} <b className="num">{m.wins}–{m.losses}</b>
            </span>
          ))}
        </div>
      )}

      <div className="mu-sub">Last {rv.last5.length === 1 ? "Meeting" : `${rv.last5.length} Meetings`}</div>
      <ul className="mu-meets">
        {rv.last5.map((m, i) => {
          const winner = m.result === "W" ? a : m.result === "L" ? b : m.winner;
          return (
            <li key={m.gameId || i} className="mu-meet">
              <PlayerBadge username={winner} color={colorOf(winner)} size={22} showName={false} />
              <span className="mu-meet-text">
                <b>{winner}</b> won {gameName(m.gameType)}
                <span className="mu-meet-date"> · {shortDate(m.date)}</span>
              </span>
              {openGame && m.gameId && (
                <button type="button" className="btn btn-sm" onClick={() => openGame({ gameId: m.gameId })} aria-label={`Match details, ${gameName(m.gameType)} on ${shortDate(m.date)}`}>
                  Details
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PickerSheet({ pool, current, disabled, colorOf, eloOf, onChoose, onClose }) {
  const [q, setQ] = useState("");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const list = pool.filter((u) => u.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Overlay onBackdrop={onClose}>
      <div className="modal fade mu-sheet" role="dialog" aria-modal="true" aria-label="Choose a player" onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 10 }}>
          <h2 className="mu-sheet-title">Choose a Player</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        {pool.length > 8 && (
          <input className="input mb-12" type="search" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
        )}
        <div className="mu-grid">
          {list.map((u) => (
            <button
              key={u}
              type="button"
              className={`mu-grid-btn ${u === current ? "is-on" : ""}`}
              disabled={u === disabled}
              onClick={() => onChoose(u)}
              aria-pressed={u === current}
            >
              <PlayerBadge username={u} color={colorOf(u)} size={44} showName={false} />
              <span className="mu-grid-name">{u}</span>
              <span className="mu-grid-elo num">{u === disabled ? "Other side" : eloOf(u)}</span>
            </button>
          ))}
          {!list.length && <p className="subtle" style={{ gridColumn: "1 / -1", margin: 0 }}>No one matches.</p>}
        </div>
      </div>
    </Overlay>
  );
}

function SwapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  );
}
