import { useState } from "react";
import { LineChart, BarChart, MultiLineChart, GroupedBarChart, DonutChart, StatCards, DartHeatmap } from "./Charts";
import BadgeMedal from "./BadgeMedal";
import BadgeDetail from "./BadgeDetail";
import { PlayerBadge } from "./ui";
import { progressText } from "@/lib/achievements";

const shortDay = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

/** Achievement medals the AI picked, drawn from the player's own badges. */
function BadgesWidget({ ids, badges }) {
  const [open, setOpen] = useState(null);
  const byId = new Map((badges || []).map((b) => [b.id, b]));
  const list = (ids || []).map((id) => byId.get(id)).filter(Boolean);
  if (!list.length) return null;
  return (
    <>
      <div className="badge-grid ai-badges">
        {list.map((b) => {
          const pct = b.progress && b.progress.target ? Math.round((b.progress.value / b.progress.target) * 100) : 0;
          return (
            <button type="button" key={b.id} className={`badge-tile${b.unlocked ? "" : " locked"}`} onClick={() => setOpen(b)} aria-label={`${b.title}: ${b.unlocked ? "unlocked" : "locked"}. Details`}>
              <BadgeMedal badge={b} locked={!b.unlocked} size={42} className="badge-icon" />
              <div className="badge-title">{b.title}</div>
              {b.unlocked ? (
                <div className="badge-meta">{shortDay(b.earnedAt)}</div>
              ) : b.progress ? (
                <>
                  <div className="badge-progress" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="badge-meta">{progressText(b.progress, { short: true })}</div>
                </>
              ) : (
                <div className="badge-meta">Locked</div>
              )}
            </button>
          );
        })}
      </div>
      {open && <BadgeDetail badge={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const MODE_NAMES = { x01: "X01", cricket: "Cricket", baseball: "Baseball" };
const modeName = (k) => MODE_NAMES[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : "");

/** You vs one opponent: the record, win % and the last five meetings. */
function VersusWidget({ chart, me, colors }) {
  const modes = Object.entries(chart.byGameType || {}).filter(([, v]) => v && v.games);
  return (
    <div className="ai-versus">
      <div className="ai-versus-top">
        <div className="ai-versus-side">
          <PlayerBadge username={me || "You"} color={colors?.[me]} size={40} showName={false} />
          <span>{me || "You"}</span>
        </div>
        <div className="ai-versus-score num">
          <b>{chart.wins}</b>
          <i>–</i>
          <b>{chart.losses}</b>
        </div>
        <div className="ai-versus-side">
          <PlayerBadge username={chart.opponent} color={colors?.[chart.opponent]} size={40} showName={false} />
          <span>{chart.opponent}</span>
        </div>
      </div>
      <div className="ai-versus-meta">
        {chart.games} {chart.games === 1 ? "game" : "games"}
        {chart.winPct != null && ` · ${Math.round(chart.winPct)}% won`}
        {chart.otherWinner > 0 && ` · ${chart.otherWinner} won by someone else`}
      </div>
      {modes.length > 1 && (
        <div className="mu-modes">
          {modes.map(([k, v]) => (
            <span key={k} className="mu-mode">
              {modeName(k)} <b className="num">{v.wins}–{v.losses}</b>
            </span>
          ))}
        </div>
      )}
      {chart.last5?.length > 0 && (
        <div className="ai-versus-last" aria-label="Last five meetings, newest first">
          <span>Last {chart.last5.length}</span>
          <div className="mu-pips">
            {chart.last5.map((m, i) => (
              <span key={i} className={`mu-pip ${m.result === "W" ? "is-w" : m.result === "L" ? "is-l" : ""}`} title={`${modeName(m.game)} · ${m.date}`}>
                {m.result === "O" ? "–" : m.result}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One chart Blackbird AI attached to a reply (resolved by lib/aiChart.js,
 * so every number is the app's own). Used by the chat and match reports.
 */
export default function AIChart({ chart, badges = null, me = null, colors = null }) {
  if (!chart) return null;
  let body = null;
  if (chart.type === "badges" && chart.ids?.length && badges?.length) body = <BadgesWidget ids={chart.ids} badges={badges} />;
  else if (chart.type === "versus" && chart.opponent) body = <VersusWidget chart={chart} me={me} colors={colors} />;
  else if (chart.type === "stats" && chart.items?.length) body = <StatCards items={chart.items} />;
  else if (chart.type === "heatmap" && chart.cells) body = <DartHeatmap cells={chart.cells} darts={chart.darts} misses={chart.misses} missLabel={chart.missLabel} />;
  else if (chart.type === "donut" && chart.slices?.length) body = <DonutChart slices={chart.slices} unit={chart.unit} decimals={chart.decimals} />;
  else if (chart.datasets?.length) {
    body =
      chart.type === "bar" || chart.type === "stackedBar" ? (
        <GroupedBarChart labels={chart.labels} datasets={chart.datasets} stacked={chart.type === "stackedBar"} unit={chart.unit} decimals={chart.decimals} textScale={1.3} />
      ) : (
        <MultiLineChart labels={chart.labels} datasets={chart.datasets} unit={chart.unit} decimals={chart.decimals} textScale={1.3} />
      );
  } else if (chart.points?.length) {
    body = chart.type === "bar" ? <BarChart data={chart.points} color={chart.color} textScale={1.3} /> : <LineChart data={chart.points} color={chart.color} unit={chart.unit} decimals={chart.decimals} textScale={1.3} />;
  }
  if (!body) return null;
  return (
    <figure className="ai-chart">
      {chart.title && <figcaption className="ai-chart-title">{chart.title}</figcaption>}
      {body}
    </figure>
  );
}

/** Charts on a stored message: the list, or the single chart older replies kept. */
export function chartsOf(m) {
  if (Array.isArray(m?.charts) && m.charts.length) return m.charts;
  return m?.chart ? [m.chart] : [];
}
