import { useEffect, useMemo, useState } from "react";
import { Mini } from "../ui";
import { LineChart, MultiLineChart, DartHeatmap } from "../Charts";
import { gameName } from "@/lib/summary";
import { gameTypesPlayed, landingHeatmap, dartByDart, paceOfPlay, whenPlayed, underPressure, rivalryTimelines, practiceVsRanked, botProgress, DAYS, BLOCKS, PACE_SPLIT_MIN } from "@/lib/deepStats";

/**
 * The deeper statistics on the profile's Statistics tab, all drawn from
 * games already saved (lib/deepStats.js): a career heatmap, dart-by-dart
 * splits, pace, when games happen, pressure numbers and rivalry timelines;
 * in the Practice view, practice against ranked and progress up the bot
 * ladder. One game filter drives the first four cards. A card with nothing
 * to show is left out rather than drawn empty.
 */

const ORD = ["1st dart", "2nd dart", "3rd dart"];
const pc = (v) => (v == null ? "—" : `${Math.round(v)}%`);
const num = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** True where the stats cards sit two to a row and a full-width chart is short and wide. */
function useDesktop() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  return on;
}

function Card({ title, meta, wide = false, children, note }) {
  return (
    <div className={`card${wide ? " is-wide" : ""}`}>
      <div className="between" style={{ marginBottom: 10, gap: 8 }}>
        <h3 className="section-title" style={{ margin: 0 }}>{title}</h3>
        {meta && <span className="tag" style={{ flex: "none" }}>{meta}</span>}
      </div>
      {children}
      {note && <p className="deep-note">{note}</p>}
    </div>
  );
}

function Pills({ label, options, value, onChange }) {
  return (
    <div className="deep-pills" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id ?? "all"} type="button" className="pf-filter deep-pill" aria-pressed={value === id} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Labelled horizontal bars sharing one scale. */
function Bars({ items, max = null }) {
  const top = max ?? Math.max(1e-9, ...items.map((i) => i.value || 0));
  return (
    <div className="career-bars deep-bars">
      {items.map((i) => (
        <div key={i.label} className="career-bar">
          <span className="career-bar-label">{i.label}</span>
          <span className="career-bar-track"><span style={{ width: `${Math.max(0, Math.min(100, ((i.value || 0) / top) * 100))}%`, background: i.color }} /></span>
          <span className="career-bar-value">{i.display}</span>
        </div>
      ))}
    </div>
  );
}

function HeatmapCard({ games, gameType }) {
  const h = useMemo(() => landingHeatmap(games, gameType), [games, gameType]);
  if (!h.darts) return null;
  return (
    <Card title="Dartboard Heatmap" meta={plural(h.games, "game")} note="Every logged dart by the bed it hit. A dart off the target in Baseball or Cricket is logged as a miss, with no position.">
      <DartHeatmap cells={h.cells} darts={h.darts} misses={h.misses} missLabel="missed" />
      {h.top && (
        <div className="grid-3" style={{ marginTop: 10 }}>
          <Mini label="Darts" value={h.darts} />
          <Mini label="Most hit" value={h.top.label} />
          <Mini label="On the board" value={pc(((h.darts - h.misses) / h.darts) * 100)} />
        </div>
      )}
    </Card>
  );
}

function DartByDartCard({ games, gameType }) {
  const d = useMemo(() => dartByDart(games, gameType), [games, gameType]);
  if (!d.target && !d.scoring) return null;
  const verdict = (vals, unit) => {
    if (vals.some((v) => v == null)) return null;
    const best = vals.indexOf(Math.max(...vals));
    const worst = vals.indexOf(Math.min(...vals));
    if (best === worst) return null;
    return `Strongest with the ${ORD[best].replace(" dart", "")}, weakest with the ${ORD[worst].replace(" dart", "")} (${unit(vals[best])} against ${unit(vals[worst])}).`;
  };
  return (
    <Card title="Dart by Dart" meta="1st · 2nd · 3rd">
      {d.target && (
        <>
          <div className="tag" style={{ marginBottom: 6 }}>On target · Baseball and Cricket · {plural(d.target.games, "game")}</div>
          <Bars max={100} items={d.target.positions.map((p, i) => ({ label: ORD[i], value: p.pct, display: pc(p.pct) }))} />
          <p className="deep-note">{verdict(d.target.positions.map((p) => p.pct), pc)}</p>
        </>
      )}
      {d.scoring && (
        <>
          <div className="tag" style={{ margin: `${d.target ? 12 : 0}px 0 6px` }}>Average score · X01 · {plural(d.scoring.games, "game")}</div>
          <Bars items={d.scoring.positions.map((p, i) => ({ label: ORD[i], value: p.avg, display: num(p.avg) }))} />
          <p className="deep-note">{verdict(d.scoring.positions.map((p) => p.avg), (v) => num(v))}</p>
        </>
      )}
    </Card>
  );
}

function PaceCard({ games, gameType }) {
  const p = useMemo(() => paceOfPlay(games, gameType), [games, gameType]);
  if (!p.timed) return null;
  return (
    <Card title="Pace of Play" meta={`${p.timed} of ${p.total} timed`} wide note={`A turn is timed from one of your visits to the next, so it includes waiting for the others. Games saved before timing was recorded are left out. Quick and slow halves need ${PACE_SPLIT_MIN} timed games of a mode.`}>
      <div className="grid-3 deep-pace-tiles">
        <Mini label="Avg game" value={`${num(p.avgMinutes)}m`} />
        <Mini label="Sec / turn" value={p.modes.length === 1 ? p.modes[0].secPerTurn : Math.round(p.modes.reduce((s, m) => s + m.secPerTurn * m.games, 0) / p.timed)} />
        <Mini label="Time logged" value={`${num(p.totalHours)}h`} />
      </div>
      <div className="deep-table" role="table" aria-label="Pace by game">
        {p.modes.map((m) => (
          <div key={m.gameType} className="deep-pace" role="row">
            <div className="between">
              <strong>{gameName(m.gameType)}</strong>
              <span className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>
                {plural(m.games, "game")} · {num(m.avgMinutes)} min · {m.secPerTurn}s a turn
              </span>
            </div>
            {m.quick && (
              <div className="deep-halves">
                {[["Quick games", m.quick], ["Slow games", m.slow]].map(([label, h]) => (
                  <div key={label} className="deep-half">
                    <span className="tag">{label} · {h.secPerTurn}s</span>
                    <span className="num">
                      {h.metric != null && <>{num(h.metric, m.metricDecimals)} <small>{m.metricLabel}</small></>}
                      {h.metric != null && h.winPct != null && " · "}
                      {h.winPct != null && <>{pc(h.winPct)} <small>wins</small></>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function WhenCard({ games, gameType }) {
  const w = useMemo(() => whenPlayed(games, gameType), [games, gameType]);
  const [sel, setSel] = useState(null);
  if (!w.total) return null;
  const cur = sel ? w.grid[sel[0]][sel[1]] : null;
  const shade = (n) => (n ? `color-mix(in srgb, var(--accent) ${Math.round(14 + 86 * (n / w.max))}%, var(--surface))` : "var(--surface-2)");
  return (
    <Card title="When Games Happen" meta={plural(w.total, "game")} note="By the time a game finished, in your local time. Tap a square.">
      <div className="deep-when" role="grid" aria-label="Games by day and time of day">
        <span />
        {BLOCKS.map((b) => (
          <span key={b} className="deep-when-head">{b}</span>
        ))}
        {DAYS.map((d, di) => (
          <div key={d} style={{ display: "contents" }} role="row">
            <span className="deep-when-day">{d}</span>
            {BLOCKS.map((b, bi) => {
              const c = w.grid[di][bi];
              const on = sel && sel[0] === di && sel[1] === bi;
              return (
                <button
                  key={b}
                  type="button"
                  role="gridcell"
                  className={`deep-when-cell${on ? " is-on" : ""}`}
                  style={{ background: shade(c.games) }}
                  onClick={() => setSel(on ? null : [di, bi])}
                  aria-label={`${d} from ${b}: ${plural(c.games, "game")}${c.winPct != null ? `, ${pc(c.winPct)} won` : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-read" role="status" aria-live="polite">
        {cur ? (
          <>
            <b>{DAYS[sel[0]]} from {BLOCKS[sel[1]]}</b> · {plural(cur.games, "game")}
            {cur.winPct != null && ` · ${pc(cur.winPct)} won`}
          </>
        ) : (
          <>Busiest day {w.busiestDay.label} · busiest time from {w.busiestBlock.label}</>
        )}
      </div>
      {(w.bestDay || w.bestBlock) && (
        <div className="grid-3" style={{ marginTop: 10 }}>
          {w.bestDay && <Mini label={`Best day · ${pc(w.bestDay.winPct)}`} value={w.bestDay.label} />}
          {w.worstDay && <Mini label={`Worst day · ${pc(w.worstDay.winPct)}`} value={w.worstDay.label} />}
          {w.bestBlock && <Mini label={`Best time · ${pc(w.bestBlock.winPct)}`} value={w.bestBlock.label} />}
        </div>
      )}
    </Card>
  );
}

function PressureCard({ games, opponents }) {
  const u = useMemo(() => underPressure(games, opponents), [games, opponents]);
  if (!u.baseball && !u.x01) return null;
  const b = u.baseball;
  return (
    <Card title="Under Pressure" meta="Clutch">
      {b && (
        <>
          <div className="tag" style={{ marginBottom: 6 }}>Baseball runs per inning · {plural(b.games, "game")}</div>
          <Bars
            items={[
              { label: "Inn 1–3", value: b.early, display: num(b.early, 2) },
              { label: "Inn 4–6", value: b.middle, display: num(b.middle, 2) },
              { label: "Inn 7–9", value: b.late, display: num(b.late, 2) },
            ]}
          />
          <p className="deep-note">
            {b.late > b.early ? `Finishes stronger than it starts: ${num(b.late - b.early, 2)} more runs an inning in the last three.` : b.late < b.early ? `Starts stronger than it finishes: ${num(b.early - b.late, 2)} fewer runs an inning in the last three.` : "The same early and late."}
          </p>
        </>
      )}
      {u.x01 && (
        <>
          <div className="tag" style={{ margin: `${b ? 12 : 0}px 0 6px` }}>X01 checkout % · {plural(u.x01.games, "game")}</div>
          <Bars
            max={100}
            items={[
              { label: "Opp. on a finish", value: u.x01.pressure.pct, display: u.x01.pressure.chances ? `${pc(u.x01.pressure.pct)} · ${u.x01.pressure.hits}/${u.x01.pressure.chances}` : "—" },
              { label: "Opp. not on one", value: u.x01.calm.pct, display: u.x01.calm.chances ? `${pc(u.x01.calm.pct)} · ${u.x01.calm.hits}/${u.x01.calm.chances}` : "—" },
            ]}
          />
          <p className="deep-note">Darts at a finish while an opponent had 170 or less left, against when they did not.</p>
        </>
      )}
    </Card>
  );
}

function RivalryTimelineCard({ games, user, isMe }) {
  const list = useMemo(() => rivalryTimelines(games), [games]);
  const [pick, setPick] = useState(null);
  const desktop = useDesktop();
  if (!list.length) return null;
  const cur = list.find((t) => t.opponent === pick) || list[0];
  const who = isMe ? "You" : user;
  const lead = cur.wins - cur.losses;
  return (
    <Card title="Rivalry Timeline" meta={`${cur.wins}–${cur.losses}`} wide note={`Wins minus losses against ${cur.opponent} after each meeting. Above zero, ${isMe ? "you are" : `${user} is`} ahead.`}>
      {list.length > 1 && <Pills label="Opponent" value={cur.opponent} onChange={setPick} options={list.map((t) => [t.opponent, `${t.opponent} (${t.games})`])} />}
      <div className="deep-lead">
        <span className="num">{lead > 0 ? `+${lead}` : lead}</span>
        <span>
          {lead === 0 ? "Level" : `${who} ${lead > 0 ? "lead" + (isMe ? "" : "s") : "trail" + (isMe ? "" : "s")}`} after {plural(cur.games, "meeting")}
          {cur.other > 0 && ` · ${cur.other} won by someone else`}
        </span>
      </div>
      {cur.points.length > 1 ? <LineChart data={cur.points} color="var(--accent)" wide={desktop} /> : <p className="deep-note">One meeting so far. The line starts with the second.</p>}
    </Card>
  );
}

function PracticeVsRankedCard({ ranked, practice }) {
  const list = useMemo(() => practiceVsRanked(ranked, practice), [ranked, practice]);
  const [pick, setPick] = useState(null);
  if (!list.length) return null;
  const cur = list.find((m) => m.gameType === pick) || [...list].sort((a, b) => b.practice.games + b.ranked.games - (a.practice.games + a.ranked.games))[0];
  const gap = cur.practice.overall - cur.ranked.overall;
  return (
    <Card title="Practice vs Ranked" meta="All time" note={`${cur.label}, by ${cur.unit}. ${plural(cur.ranked.games, "ranked game")} and ${plural(cur.practice.games, "practice game")}.`}>
      {list.length > 1 && <Pills label="Game" value={cur.gameType} onChange={setPick} options={list.map((m) => [m.gameType, gameName(m.gameType)])} />}
      <div className="grid-3" style={{ marginBottom: 10 }}>
        <Mini label={`Ranked ${cur.short}`} value={num(cur.ranked.overall, cur.decimals)} />
        <Mini label={`Practice ${cur.short}`} value={num(cur.practice.overall, cur.decimals)} />
        <Mini label="Practice is" value={`${gap > 0 ? "+" : ""}${num(gap, cur.decimals)}`} />
      </div>
      <MultiLineChart
        labels={cur.labels}
        decimals={cur.decimals}
        datasets={[
          { name: "Ranked", color: "var(--accent)", points: cur.ranked.points },
          { name: "Practice", color: "var(--amber)", points: cur.practice.points },
        ]}
      />
    </Card>
  );
}

// near-black bot colors would vanish on the dark theme
const lineColor = (hex) => {
  if (!hex) return "var(--ink-soft)";
  const n = parseInt(hex.slice(1), 16);
  const lum = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return lum < 60 ? "var(--ink)" : hex;
};

function BotProgressCard({ practice }) {
  const bots = useMemo(() => botProgress(practice), [practice]);
  if (!bots.length) return null;
  const longest = Math.max(...bots.map((b) => b.games));
  return (
    <Card title="Bot Ladder Progress" meta="All time" note="Win % against each bot as the games against it add up. A line that climbs past 50% says the next bot is worth a go.">
      <MultiLineChart unit="%" labels={Array.from({ length: longest }, (_, i) => `Game ${i + 1}`)} datasets={bots.map((b) => ({ name: `${b.name} ${b.wins}–${b.games - b.wins}`, color: lineColor(b.color), points: b.points }))} />
    </Card>
  );
}

/**
 * @param games       the player's games in the chosen date range (lib/deepStats prepareGames)
 * @param opponents   X01 opponents by game id (lib/deepStats x01Opponents)
 * @param practice    true in the Practice view: no rivalries, and the two practice-only cards
 * @param rankedAll / practiceAll   all-time games, for the practice-only cards
 */
export default function DeepStats({ user, isMe = false, games = [], opponents, practice = false, rankedAll = [], practiceAll = [] }) {
  const types = useMemo(() => gameTypesPlayed(games), [games]);
  const [picked, setPicked] = useState(null);
  const gameType = types.some((t) => t.gameType === picked) ? picked : null;
  if (!games.length && !(practice && practiceAll.length)) return null;
  return (
    <section className="deep" aria-label="Deeper statistics">
      {games.length > 0 && (
        <div className="deep-head">
          <h3 className="section-title" style={{ margin: 0 }}>Deeper Stats</h3>
          {types.length > 1 && <Pills label="Game" value={gameType} onChange={setPicked} options={[[null, "All Games"], ...types.map((t) => [t.gameType, gameName(t.gameType)])]} />}
        </div>
      )}
      <div className="charts-2col">
        <HeatmapCard games={games} gameType={gameType} />
        <WhenCard games={games} gameType={gameType} />
        <DartByDartCard games={games} gameType={gameType} />
        <PressureCard games={games} opponents={opponents} />
        <PaceCard games={games} gameType={gameType} />
        {!practice && <RivalryTimelineCard games={games} user={user} isMe={isMe} />}
        {practice && <PracticeVsRankedCard ranked={rankedAll} practice={practiceAll} />}
        {practice && <BotProgressCard practice={practiceAll} />}
      </div>
    </section>
  );
}
