import { useContext } from "react";
import { X01_TARGETS, BASEBALL_INNINGS, defaultPlayerColor } from "@/lib/constants";
import { dartValue, dartLabel, markSymbol } from "@/lib/darts";
import { previewKillerVisit } from "@/lib/killer";
import { tvCardSize, killerCurrent, killerTargets, lastX01Visit } from "@/lib/tvLayout";
import DartBoard from "@/components/DartBoard";
import { PlayerBadge, PlayerLookContext } from "@/components/ui";

const numOf = (t) => (t === "B" ? 25 : Number(t));
const targetLabel = (n) => (n === 25 ? "Bull" : String(n));

/**
 * Big-screen scoreboard rendered on /tv from the phone's broadcast
 * snapshots. Pure function of {game, snapshot} — no local game logic.
 * `showBoard` is the TV's "hide board" choice; layouts without a dartboard
 * ignore it (see TV_BOARD_GAMES in lib/tvLayout.js).
 */
export default function TVScoreboard({ game, snapshot, showBoard = true }) {
  if (!game || !snapshot) return null;
  const props = { game, snapshot, showBoard };
  if (game.gameType === "cricket") return <TVCricket {...props} />;
  if (game.gameType === "x01") return <TVX01 {...props} />;
  if (game.gameType === "baseball") return <TVBaseball {...props} />;
  if (game.gameType === "killer") return <TVKiller {...props} />;
  if (game.gameType === "shanghai") return <TVShanghai {...props} />;
  if (game.gameType === "tictactoe") return <TVTicTacToe {...props} />;
  if (game.gameType === "aroundTheClock") return <TVGeneric {...props} title="Around the Clock" />;
  if (game.gameType === "halveit") return <TVGeneric {...props} title="Halve It" />;
  if (game.gameType === "gotcha") return <TVGeneric {...props} title="Gotcha" />;
  if (game.gameType === "bobs27") return <TVGeneric {...props} title="Bob's 27" />;
  if (game.gameType === "checkoutDrill") return <TVGeneric {...props} title="Checkout Drill" />;
  if (game.gameType === "scoringDrill") return <TVGeneric {...props} title="Scoring Drill" />;
  return null;
}

function TVCricket({ game, snapshot, showBoard }) {
  const { players } = game;
  const variant = game.config?.variant || "standard";
  const { state, turn, darts = [] } = snapshot;
  if (!state) return null;
  const cur = players[turn % players.length];
  const round = Math.floor(turn / players.length) + 1;
  const mpr = (u) => (state[u].rounds ? (state[u].markCount / state[u].rounds).toFixed(2) : "—");
  const variantLabel =
    variant === "cutthroat" ? "Cutthroat" : variant === "noscore" ? "No-score" : "Score";
  // same board view as the phone: current player's open numbers glow,
  // this turn's darts are plotted
  const openTargets = X01_TARGETS.filter((t) => state[cur].marks[t] < 3).map(numOf);
  const boardHits = darts.map((d) => ({ n: numOf(d.target), mult: d.ring }));

  return (
    <div className="tv-board">
      <TVHeader left={`Cricket · ${variantLabel}`} right={`Round ${round}`} />
      <TVSplit board={showBoard && <DartBoard highlight={openTargets} hits={boardHits} />}>
        <table className="tv-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {X01_TARGETS.map((t) => (
                <th key={t}>{t}</th>
              ))}
              {variant !== "noscore" && <th>Pts</th>}
              <th>MPR</th>
            </tr>
          </thead>
          <tbody>
            {players.map((u) => (
              <tr key={u} className={u === cur ? "active" : ""}>
                <td className="tv-name"><PlayerBadge username={u} size={22} /></td>
                {X01_TARGETS.map((t) => (
                  <td
                    key={t}
                    className="tv-num"
                    style={{ color: state[u].marks[t] >= 3 ? "var(--accent)" : "var(--ink)" }}
                  >
                    {markSymbol(Math.min(state[u].marks[t], 3))}
                  </td>
                ))}
                {variant !== "noscore" && (
                  <td className="tv-num" style={{ color: "var(--amber)" }}>
                    {state[u].points}
                  </td>
                )}
                <td className="tv-num tv-muted">{mpr(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TVSplit>
    </div>
  );
}

function TVX01({ game, snapshot, showBoard }) {
  const { players, config } = game;
  const { s, turn, turnDarts = [], msg, legsWon } = snapshot;
  if (!s) return null;
  const n = players.length;
  const cur = players[turn % n];
  const prev = players[(turn - 1 + n) % n];
  const turnSum = turnDarts.reduce((a, d) => a + dartValue(d), 0);
  const avg = (u) => (s.darts[u] ? ((s.points[u] / s.darts[u]) * 3).toFixed(1) : "0.0");
  const legs = config.legs || 1;
  const leg = s.legs?.[cur]?.length || 0; // legs already finished
  const needed = Math.ceil(legs / 2);
  const right = [legs > 1 ? `Best of ${legs} · leg ${leg + 1}` : "", msg || ""].filter(Boolean).join(" · ");

  return (
    <div className="tv-board">
      <TVHeader
        left={`${config.startScore} · ${config.doubleOut ? "double out" : "straight out"}`}
        right={right}
        rightColor={msg ? "var(--red)" : undefined}
      />
      <TVSplit board={showBoard && <DartBoard hits={turnDarts} />}>
        <TVCards count={n} board={showBoard} chars={3}>
          {players.map((u) => {
            const active = u === cur;
            const shown = active ? s.scores[u] - turnSum : s.scores[u];
            const last = lastX01Visit(s.rec, u, leg);
            // the visit just thrown stays lit until the next one is done
            const big = !active && u === prev && last && !last.bust && last.score >= 100;
            return (
              <TVCard
                key={u}
                username={u}
                active={active}
                badge={legs > 1 && <TVLegs won={legsWon?.[u] || 0} needed={needed} />}
              >
                <div className="tv-card-value" style={{ color: shown <= 40 ? "var(--red)" : undefined }}>
                  {shown}
                </div>
                <div className="tv-card-sub">
                  {last && (
                    <>
                      last <b className={big ? "tv-big-visit" : undefined}>{last.bust ? "bust" : last.score}</b> ·{" "}
                    </>
                  )}
                  avg {avg(u)} · {s.darts[u]} darts
                </div>
                {active && <TVVisit darts={turnDarts} total={turnSum} />}
              </TVCard>
            );
          })}
        </TVCards>
      </TVSplit>
    </div>
  );
}

function TVBaseball({ game, snapshot, showBoard }) {
  const { players } = game;
  const { state, turn, turnDarts = [] } = snapshot;
  if (!state) return null;
  const n = players.length;
  const cur = players[turn % n];
  const inning = Math.floor(turn / n) + 1;
  const innings = BASEBALL_INNINGS;
  const target = ((inning - 1) % 20) + 1;
  const colCount = Math.max(inning, innings);
  const cols = Array.from({ length: colCount }, (_, i) => i + 1);

  return (
    <div className="tv-board">
      <TVHeader left="Baseball" right={`Inning ${inning} · aiming at ${target}`} />
      <TVSplit board={showBoard && <DartBoard highlight={target ? [target] : []} hits={turnDarts} />}>
        <table className="tv-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}></th>
              {cols.map((c) => (
                <th key={c} style={{ color: c === inning ? "var(--accent)" : undefined }}>
                  {c > innings ? "E" : c}
                </th>
              ))}
              <th>R</th>
            </tr>
          </thead>
          <tbody>
            {players.map((u) => (
              <tr key={u} className={u === cur ? "active" : ""}>
                <td className="tv-name"><PlayerBadge username={u} size={22} /></td>
                {cols.map((c) => (
                  <td key={c} className="tv-num">
                    {state[u].innings[c - 1] != null ? state[u].innings[c - 1] : ""}
                  </td>
                ))}
                <td className="tv-num" style={{ color: "var(--amber)" }}>
                  {state[u].total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TVSplit>
    </div>
  );
}

function TVKiller({ game, snapshot, showBoard }) {
  const { players, config } = game;
  const numbers = config.numbers || {};
  const startLives = config.lives || 3;
  const { s, turn, turnDarts = [] } = snapshot;
  if (!s || !s.lives) return null;
  const cur = killerCurrent(players, s.lives, turn);
  // the visit in progress applied, exactly like the phone's header
  const live = previewKillerVisit(s, cur, turnDarts, { players, numbers });
  const targets = killerTargets(players, numbers, live.lives, live.killer, cur);
  const round = Math.floor(turn / players.length) + 1;
  const aim = live.killer[cur]
    ? `aim at ${targets.map((t) => `D${t}`).join(" ") || "—"}`
    : `D${numbers[cur]} makes a killer`;

  return (
    <div className="tv-board">
      <TVHeader left="Killer" right={`Round ${round} · ${aim}`} />
      <TVSplit board={showBoard && <DartBoard highlight={targets} hits={turnDarts} />}>
        <TVCards count={players.length} board={showBoard} chars={Math.max(3, startLives * 0.75)}>
          {players.map((u) => {
            const lives = Math.max(0, live.lives[u]);
            const out = lives <= 0;
            return (
              <TVCard key={u} username={u} active={u === cur} out={out}>
                <div className="tv-killer-num">
                  #{numbers[u]}
                  <span className={`tv-killer-state${live.killer[u] && !out ? " is-killer" : ""}`}>
                    {out ? "out" : live.killer[u] ? "killer" : "not killer"}
                  </span>
                </div>
                <div className="tv-pips" role="img" aria-label={`${lives} ${lives === 1 ? "life" : "lives"}`}>
                  {Array.from({ length: Math.max(startLives, lives) }, (_, i) => (
                    <span key={i} className={i < lives ? "is-on" : ""}>♥</span>
                  ))}
                </div>
                <div className="tv-card-sub">
                  {lives} {lives === 1 ? "life" : "lives"} · {s.darts?.[u] || 0} darts
                </div>
                {u === cur && <TVVisit darts={turnDarts} />}
              </TVCard>
            );
          })}
        </TVCards>
      </TVSplit>
    </div>
  );
}

const SHANGHAI_TARGETS = { beginner: [1, 2, 3, 4, 5, 6, 7], advanced: [15, 16, 17, 18, 19, 20, 25] };

function TVShanghai({ game, snapshot, showBoard }) {
  const { players, config } = game;
  const targets = SHANGHAI_TARGETS[config.mode === "advanced" ? "advanced" : "beginner"];
  const { s, turn, turnDarts = [], msg } = snapshot;
  if (!s || !s.scores) return null;
  // a level finish goes to a sudden-death tiebreak (lib/tiebreak.js): only
  // the tied leaders throw, for the highest visit, at any number
  const tb = s.tb || null;
  const cur = tb ? tb.players[tb.i] : players[turn % players.length];
  const roundIndex = Math.floor(turn / players.length);
  const target = tb ? null : targets[Math.min(roundIndex, targets.length - 1)];
  const onTarget = (darts) => (tb ? 0 : darts.filter((d) => d.n === target).reduce((a, d) => a + d.n * d.mult, 0));
  const right = [tb ? "Tiebreak" : `Round ${Math.min(roundIndex + 1, targets.length)} of ${targets.length}`, msg || ""].filter(Boolean).join(" · ");

  return (
    <div className="tv-board">
      <TVHeader left={tb ? <>Shanghai · tiebreak: highest visit wins</> : <>Shanghai · aim at <b className="tv-target">{targetLabel(target)}</b></>} right={right} />
      <TVSplit board={showBoard && <DartBoard highlight={[target]} hits={turnDarts} />}>
        <TVCards count={players.length} board={showBoard} chars={3}>
          {players.map((u) => {
            const active = u === cur;
            const thisRound = active ? onTarget(turnDarts) : s.roundScores?.[u]?.[roundIndex];
            return (
              <TVCard key={u} username={u} active={active}>
                <div className="tv-card-value">{s.scores[u] + (active ? thisRound : 0)}</div>
                <div className="tv-card-sub">
                  {thisRound != null ? <>this round <b>{thisRound}</b></> : "to throw"}
                </div>
                {active && <TVVisit darts={turnDarts} total={thisRound} />}
              </TVCard>
            );
          })}
        </TVCards>
      </TVSplit>
    </div>
  );
}

const TTT_GRID = [20, 19, 18, 17, 16, 15, 14, 13, 12];

function TVTicTacToe({ game, snapshot }) {
  const { players } = game;
  const { s, turn, turnDarts = [] } = snapshot;
  const looks = useContext(PlayerLookContext) || {};
  if (!s || !Array.isArray(s.board)) return null;
  const [p1, p2] = players;
  const cur = players[turn % players.length];
  const round = Math.floor(turn / players.length) + 1;
  // the phone's colors, with the same fallback when both players match
  const c1 = looks[p1]?.color || defaultPlayerColor(p1);
  const c2raw = looks[p2]?.color || defaultPlayerColor(p2 || "");
  const c2 = c2raw === c1 ? "var(--amber)" : c2raw;
  const colorOf = (u) => (u === p1 ? c1 : c2);
  const side = (u, mark) => (
    <TVCard key={u} username={u} active={u === cur}>
      <div className="tv-card-value" style={{ color: colorOf(u) }}>{mark}</div>
      <div className="tv-card-sub">
        <b>{s.board.filter((c) => c === u).length}</b> cells
      </div>
      {u === cur && <TVVisit darts={turnDarts} />}
    </TVCard>
  );

  return (
    <div className="tv-board">
      <TVHeader left="Tic-Tac-Toe" right={`Round ${round} · three in a row wins`} />
      <div className="tv-ttt">
        <TVCards count={1} board chars={3}>{side(p1, "X")}</TVCards>
        <div className="tv-ttt-grid" role="grid" aria-label="Tic-Tac-Toe board">
          {TTT_GRID.map((num, i) => {
            const owner = s.board[i];
            const c = owner ? colorOf(owner) : null;
            return (
              <div
                key={num}
                role="gridcell"
                className={`tv-ttt-cell${owner ? " is-claimed" : ""}`}
                style={c ? { borderColor: c, color: c, background: `color-mix(in srgb, ${c} 18%, var(--surface))` } : undefined}
              >
                <span className="tv-ttt-num">{num}</span>
                {owner && <span className="tv-ttt-mark">{owner === p1 ? "X" : "O"}</span>}
              </div>
            );
          })}
        </div>
        <TVCards count={1} board chars={3}>{p2 && side(p2, "O")}</TVCards>
      </div>
    </div>
  );
}

function TVGeneric({ game, snapshot, showBoard, title }) {
  const { players } = game;
  const { turn, turnDarts } = snapshot;
  // drills keep a per-player `state`; the party games keep one `s` object
  // with per-player maps inside it
  const state = snapshot.state ?? snapshot.s;
  if (!state) return null;
  // Shanghai / Halve It tiebreak (lib/tiebreak.js): only the tied leaders throw
  const tb = state.tb || null;
  const cur = tb ? tb.players[tb.i] : players[turn % players.length];
  const round = Math.floor(turn / players.length) + 1;
  const scoreKey = (u) => {
    const s = state[u];
    if (s != null) {
      if (typeof s === "number") return s;
      if (typeof s.score === "number") return s.score;
      if (typeof s.total === "number") return s.total;
      if (typeof s.lives === "number") return s.lives;
    }
    if (state.scores && typeof state.scores[u] === "number") return state.scores[u];
    if (state.lives && typeof state.lives[u] === "number") return state.lives[u];
    if (state.current && typeof state.current[u] === "number") return state.current[u] > 21 ? "done" : state.current[u] === 21 ? "Bull" : `→ ${state.current[u]}`;
    return "—";
  };

  return (
    <div className="tv-board">
      <TVHeader left={title} right={tb ? "Tiebreak" : `Round ${round}`} />
      <TVCards count={players.length} board={false} chars={4}>
        {players.map((u) => (
          <TVCard key={u} username={u} active={u === cur}>
            <div className="tv-card-value">{scoreKey(u)}</div>
            {u === cur && Array.isArray(turnDarts) && <TVVisit darts={turnDarts} />}
          </TVCard>
        ))}
      </TVCards>
    </div>
  );
}

/** Scores on the left, the dartboard on the right (when shown). */
function TVSplit({ board, children }) {
  return (
    <div className={`tv-split${board ? "" : " no-board"}`}>
      <div className="tv-main">{children}</div>
      {board && <div className="tv-boardwrap">{board}</div>}
    </div>
  );
}

/** Player cards sized so every player fits the screen (lib/tvLayout.js). */
function TVCards({ count, board, chars, children }) {
  const size = tvCardSize(count, { board: !!board, chars });
  return (
    <div className="tv-cards" style={{ "--tv-cols": size.cols, "--tv-card-vw": size.vw, "--tv-card-vh": size.vh }}>
      {children}
    </div>
  );
}

function TVCard({ username, active, out, badge, children }) {
  return (
    <div className={`tv-card${active ? " active" : ""}${out ? " is-out" : ""}`}>
      <div className="tv-card-name">
        <PlayerBadge username={username} size={24} sizeCss="0.9em" />
        {badge}
      </div>
      {children}
    </div>
  );
}

/** Best-of legs won, as filled pips out of the legs needed. */
function TVLegs({ won, needed }) {
  return (
    <span className="tv-legs" role="img" aria-label={`${won} ${won === 1 ? "leg" : "legs"} won`}>
      {Array.from({ length: needed }, (_, i) => (
        <span key={i} className={i < won ? "is-on" : ""} />
      ))}
    </span>
  );
}

/** The darts of the visit in progress: three slots and the running total. */
function TVVisit({ darts = [], total }) {
  return (
    <div className="tv-visit" aria-label="this visit">
      {[0, 1, 2].map((i) => (
        <span key={i} className={darts[i] ? "" : "is-empty"}>{darts[i] ? dartLabel(darts[i]) : "—"}</span>
      ))}
      {total != null && <span className="tv-visit-total">= {total}</span>}
    </div>
  );
}

function TVHeader({ left, right, rightColor }) {
  return (
    <div className="tv-header">
      <span>{left}</span>
      <span style={rightColor ? { color: rightColor } : undefined}>{right}</span>
    </div>
  );
}
