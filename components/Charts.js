import { useEffect, useRef, useState } from "react";
import { ORDER, RINGS } from "@/lib/board";

const fmtShortDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

/**
 * Tap (or drag, or hover with a mouse) to select the nearest point; arrow
 * keys move it when the chart has focus; Esc or a tap elsewhere clears it.
 * `indexAt(viewBoxX)` maps a position to a data index.
 */
function useScrub(count, W, indexAt) {
  const [sel, setSel] = useState(null);
  const wrap = useRef(null);
  const svg = useRef(null);
  const down = useRef(false);
  useEffect(() => {
    if (sel == null) return;
    const away = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setSel(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [sel]);
  const pick = (e) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const i = indexAt(((e.clientX - r.left) / r.width) * W);
    if (i != null && i >= 0 && i < count) setSel(i);
  };
  const handlers = {
    onPointerDown: (e) => {
      down.current = true;
      pick(e);
    },
    onPointerMove: (e) => {
      if (down.current || e.pointerType === "mouse") pick(e);
    },
    onPointerUp: () => {
      down.current = false;
    },
    onPointerCancel: () => {
      down.current = false;
    },
    onPointerLeave: (e) => {
      down.current = false;
      if (e.pointerType === "mouse") setSel(null);
    },
    onKeyDown: (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.key === "ArrowRight" ? 1 : -1;
        setSel((s) => Math.max(0, Math.min(count - 1, s == null ? (step > 0 ? 0 : count - 1) : s + step)));
      } else if (e.key === "Escape") setSel(null);
    },
  };
  return { sel: sel != null && sel < count ? sel : null, wrap, svg, handlers };
}

/** The floating readout above a selected point. */
function Readout({ pct, value, sub }) {
  const edge = pct < 16 ? "is-left" : pct > 84 ? "is-right" : "";
  return (
    <div className={`chart-readout ${edge}`} style={{ left: `${pct}%` }} role="status" aria-live="polite">
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

/**
 * Tiny dependency-free SVG line chart. Scales to container width via viewBox.
 * data: [{ x:number, y:number, date?:string, label?:string }]
 * textScale enlarges the axis text where the chart is drawn narrow.
 */
export function LineChart({ data, color = "var(--accent)", unit = "", decimals = 0, textScale = 1, wide = false }) {
  // a wide card gets a wider drawing, so it keeps the same height
  const W = wide ? 1200 : 600;
  const H = 230;
  const padL = Math.round(46 * textScale);
  const padR = 16;
  const n = data?.length || 0;
  const xsAll = n ? data.map((d) => d.x) : [0];
  const minX0 = Math.min(...xsAll);
  const spanX0 = Math.max(...xsAll) - minX0 || 1;
  const sxAt = (x) => padL + ((x - minX0) / spanX0) * (W - padL - padR);
  const { sel, wrap, svg, handlers } = useScrub(n, W, (vx) => {
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(sxAt(data[i].x) - vx) < Math.abs(sxAt(data[best].x) - vx)) best = i;
    return best;
  });
  if (!data || data.length === 0) {
    return (
      <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "6px 0" }}>
        Not enough games yet.
      </p>
    );
  }

  const padT = 16;
  const padB = 30;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const padY = (maxY - minY) * 0.15;
  minY -= padY;
  maxY += padY;
  if (unit === "%") {
    minY = Math.max(0, minY);
    maxY = Math.min(100, maxY);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;

  const sx = (x) => padL + ((x - minX) / spanX) * (W - padL - padR);
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);

  const fmt = (v) => {
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
  };

  const ticks = [maxY, (minY + maxY) / 2, minY];
  const points = data.map((d) => `${sx(d.x)},${sy(d.y)}`).join(" ");
  const areaPath =
    `M ${sx(data[0].x)},${sy(data[0].y)} ` +
    data.slice(1).map((d) => `L ${sx(d.x)},${sy(d.y)}`).join(" ") +
    ` L ${sx(data[data.length - 1].x)},${H - padB} L ${sx(data[0].x)},${H - padB} Z`;

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const gradId = `g-${color.replace(/[^a-z0-9]/gi, "")}`;
  const cur = sel != null ? data[sel] : null;

  return (
    <div className="chart-wrap" ref={wrap}>
    {cur && <Readout pct={(sx(cur.x) / W) * 100} value={`${fmt(cur.y)}${unit}`} sub={cur.label || fmtShortDate(cur.date)} />}
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      tabIndex={0}
      aria-label="Chart. Tap a point, or use the arrow keys, to read its value."
      className="chart-svg"
      style={{ display: "block" }}
      {...handlers}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={sy(t)}
            y2={sy(t)}
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text x={padL - 8} y={sy(t) + 4} textAnchor="end" fontSize={13 * textScale} fill="var(--ink-soft)">
            {fmt(t)}
            {unit}
          </text>
        </g>
      ))}

      {data.length > 1 && <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />}

      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <circle key={i} cx={sx(d.x)} cy={sy(d.y)} r={data.length > 24 ? 0 : 3} fill={color} />
      ))}

      {cur && (
        <g pointerEvents="none">
          <line x1={sx(cur.x)} x2={sx(cur.x)} y1={padT} y2={H - padB} stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx={sx(cur.x)} cy={sy(cur.y)} r="7" fill={color} stroke="var(--surface)" strokeWidth="3" />
        </g>
      )}

      <text x={padL} y={H - 8} textAnchor="start" fontSize={12 * textScale} fill="var(--ink-soft)">
        {data[0].label || fmtDate(data[0].date)}
      </text>
      {data.length > 1 && (
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize={12 * textScale} fill="var(--ink-soft)">
          {data[data.length - 1].label || fmtDate(data[data.length - 1].date)}
        </text>
      )}
    </svg>
    </div>
  );
}

/**
 * Matching dependency-free SVG bar chart. Same frame/axis style as
 * LineChart. data: [{ x:number, y:number, date?:string, label?:string }] —
 * one bar per point (used on Home for games per week over the last 3
 * months, and by Blackbird AI for comparisons, where each bar has a label).
 */
export function BarChart({ data, color = "var(--accent)", textScale = 1 }) {
  const W = 600;
  const padL = Math.round(40 * textScale);
  const padR = 12;
  const n = data?.length || 0;
  const slotW = n ? (W - padL - padR) / n : 1;
  const { sel, wrap, svg, handlers } = useScrub(n, W, (vx) => Math.max(0, Math.min(n - 1, Math.floor((vx - padL) / slotW))));
  if (!data || data.length === 0 || !data.some((d) => d.y > 0)) {
    return (
      <p className="tag" style={{ textTransform: "none", letterSpacing: 0, margin: "6px 0" }}>
        No games in this period yet.
      </p>
    );
  }

  const H = 200;
  const padT = 14;
  const padB = 28;

  const maxY = Math.max(1, ...data.map((d) => d.y));
  const sy = (v) => padT + (1 - v / maxY) * (H - padT - padB);
  const slot = (W - padL - padR) / data.length;
  const bw = Math.min(slot * 0.62, 34);

  const mid = Math.round(maxY / 2);
  const ticks = mid > 0 && mid < maxY ? [maxY, mid, 0] : [maxY, 0];
  // short labels under each bar (opponent names, months) when there is room
  const labelled = data.length <= 12 && data.every((d) => d.label);

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const cur = sel != null ? data[sel] : null;

  return (
    <div className="chart-wrap" ref={wrap}>
    {cur && <Readout pct={((padL + sel * slot + slot / 2) / W) * 100} value={String(cur.y)} sub={cur.label || fmtShortDate(cur.date)} />}
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      tabIndex={0}
      aria-label="Chart. Tap a bar, or use the arrow keys, to read its value."
      className="chart-svg"
      style={{ display: "block" }}
      {...handlers}
    >
      {cur && <rect x={padL + sel * slot} y={padT} width={slot} height={H - padT - padB} fill="var(--ink)" opacity="0.06" pointerEvents="none" />}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 8} y={sy(t) + 4} textAnchor="end" fontSize={13 * textScale} fill="var(--ink-soft)">
            {t}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const x = padL + i * slot + (slot - bw) / 2;
        const y = sy(d.y);
        const h = Math.max(0, H - padB - y);
        if (h === 0) return null;
        return <rect key={i} x={x} y={y} width={bw} height={h} rx="3" fill={color} opacity={sel != null && sel !== i ? 0.4 : 1} />;
      })}

      {labelled ? (
        data.map((d, i) => (
          <text key={`l${i}`} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={12 * textScale} fill="var(--ink-soft)">
            {d.label}
          </text>
        ))
      ) : (
        <>
          <text x={padL} y={H - 8} textAnchor="start" fontSize={12 * textScale} fill="var(--ink-soft)">
            {fmtDate(data[0].date) || data[0].label || ""}
          </text>
          {data.length > 1 && (
            <text x={W - padR} y={H - 8} textAnchor="end" fontSize={12 * textScale} fill="var(--ink-soft)">
              {fmtDate(data[data.length - 1].date) || data[data.length - 1].label || ""}
            </text>
          )}
        </>
      )}
    </svg>
    </div>
  );
}

const fmtNum = (v, decimals = 0) => {
  if (v == null) return "–";
  const f = Math.pow(10, decimals);
  return String(Math.round(v * f) / f);
};

function Legend({ datasets }) {
  return (
    <div className="chart-legend">
      {datasets.map((d) => (
        <span key={d.name}>
          <i style={{ background: d.color }} />
          {d.name}
        </span>
      ))}
    </div>
  );
}

/**
 * Several series on one shared x axis (labels[i] is x = i + 1), e.g. you vs
 * an opponent by month. Tap to read every series at that point.
 */
export function MultiLineChart({ labels = [], datasets = [], unit = "", decimals = 0, textScale = 1 }) {
  const W = 600;
  const H = 230;
  const padL = Math.round(46 * textScale);
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const n = Math.max(labels.length, ...datasets.flatMap((d) => d.points.map((p) => p.x)), 1);
  const sx = (x) => padL + (n === 1 ? 0.5 : (x - 1) / (n - 1)) * (W - padL - padR);
  const { sel, wrap, svg, handlers } = useScrub(n, W, (vx) => Math.max(0, Math.min(n - 1, Math.round(((vx - padL) / (W - padL - padR)) * (n - 1)))));
  const ys = datasets.flatMap((d) => d.points.map((p) => p.y));
  if (!ys.length) return null;
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const allPositive = minY >= 0;
  const pad = (maxY - minY) * 0.15;
  minY -= pad;
  maxY += pad;
  if (allPositive) minY = Math.max(0, minY); // no axis below zero for counts and scores
  if (unit === "%") {
    minY = Math.max(0, minY);
    maxY = Math.min(100, maxY);
  }
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);
  const ticks = [maxY, (minY + maxY) / 2, minY];
  const x = sel != null ? sel + 1 : null;
  const at = x != null ? datasets.map((d) => ({ d, p: d.points.find((p) => p.x === x) })).filter((v) => v.p) : [];
  return (
    <div className="chart-wrap" ref={wrap}>
      {x != null && at.length > 0 && (
        <Readout pct={(sx(x) / W) * 100} value={at.map((v) => `${v.d.name}: ${fmtNum(v.p.y, decimals)}${unit}`).join(" · ")} sub={labels[x - 1] || fmtShortDate(at[0].p.date)} />
      )}
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" tabIndex={0} aria-label="Comparison chart. Tap a point to read the values." className="chart-svg" style={{ display: "block" }} {...handlers}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 8} y={sy(t) + 4} textAnchor="end" fontSize={13 * textScale} fill="var(--ink-soft)">
              {fmtNum(t, decimals)}
              {unit}
            </text>
          </g>
        ))}
        {datasets.map((d) => (
          <g key={d.name}>
            <polyline points={d.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} fill="none" stroke={d.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {d.points.length <= 24 && d.points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={d.color} />)}
          </g>
        ))}
        {x != null && (
          <g pointerEvents="none">
            <line x1={sx(x)} x2={sx(x)} y1={padT} y2={H - padB} stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="4 4" />
            {at.map((v) => (
              <circle key={v.d.name} cx={sx(x)} cy={sy(v.p.y)} r="6" fill={v.d.color} stroke="var(--surface)" strokeWidth="3" />
            ))}
          </g>
        )}
        <text x={padL} y={H - 8} textAnchor="start" fontSize={12 * textScale} fill="var(--ink-soft)">
          {labels[0] || ""}
        </text>
        {n > 1 && (
          <text x={W - padR} y={H - 8} textAnchor="end" fontSize={12 * textScale} fill="var(--ink-soft)">
            {labels[n - 1] || ""}
          </text>
        )}
      </svg>
      <Legend datasets={datasets} />
    </div>
  );
}

/** Bars per label for several series, side by side or stacked. */
export function GroupedBarChart({ labels = [], datasets = [], stacked = false, unit = "", decimals = 0, textScale = 1 }) {
  const W = 600;
  const H = 210;
  const padL = Math.round(40 * textScale);
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const n = Math.max(labels.length, 1);
  const slot = (W - padL - padR) / n;
  const { sel, wrap, svg, handlers } = useScrub(n, W, (vx) => Math.max(0, Math.min(n - 1, Math.floor((vx - padL) / slot))));
  const val = (d, i) => d.points.find((p) => p.x === i + 1)?.y ?? 0;
  const totals = labels.map((_, i) => datasets.reduce((a, d) => a + Math.max(0, val(d, i)), 0));
  const maxY = Math.max(1, ...(stacked ? totals : datasets.flatMap((d) => d.points.map((p) => p.y))));
  const sy = (v) => padT + (1 - v / maxY) * (H - padT - padB);
  const groupW = Math.min(slot * 0.7, stacked ? 34 : 18 * datasets.length);
  const at = sel != null ? datasets.map((d) => ({ d, y: val(d, sel) })) : [];
  return (
    <div className="chart-wrap" ref={wrap}>
      {sel != null && <Readout pct={((padL + sel * slot + slot / 2) / W) * 100} value={at.map((v) => `${v.d.name}: ${fmtNum(v.y, decimals)}${unit}`).join(" · ")} sub={labels[sel]} />}
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" tabIndex={0} aria-label="Bar chart. Tap a bar to read the values." className="chart-svg" style={{ display: "block" }} {...handlers}>
        {[maxY, 0].map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 8} y={sy(t) + 4} textAnchor="end" fontSize={13 * textScale} fill="var(--ink-soft)">
              {fmtNum(t, decimals)}
            </text>
          </g>
        ))}
        {sel != null && <rect x={padL + sel * slot} y={padT} width={slot} height={H - padT - padB} fill="var(--ink)" opacity="0.06" pointerEvents="none" />}
        {labels.map((_, i) => {
          const x0 = padL + i * slot + (slot - groupW) / 2;
          let base = 0;
          return datasets.map((d, j) => {
            const v = Math.max(0, val(d, i));
            if (!v) return null;
            const y1 = sy(stacked ? base + v : v);
            const y0 = sy(stacked ? base : 0);
            base += v;
            const w = stacked ? groupW : groupW / datasets.length;
            const x = stacked ? x0 : x0 + j * w;
            return <rect key={`${i}-${j}`} x={x} y={y1} width={Math.max(1, w - (stacked ? 0 : 2))} height={Math.max(0, y0 - y1)} rx="2" fill={d.color} opacity={sel != null && sel !== i ? 0.4 : 1} />;
          });
        })}
        {labels.length <= 12
          ? labels.map((l, i) => (
              <text key={i} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={12 * textScale} fill="var(--ink-soft)">
                {String(l).slice(0, 6)}
              </text>
            ))
          : [0, labels.length - 1].map((i) => (
              <text key={i} x={i ? W - padR : padL} y={H - 8} textAnchor={i ? "end" : "start"} fontSize={12 * textScale} fill="var(--ink-soft)">
                {labels[i]}
              </text>
            ))}
      </svg>
      <Legend datasets={datasets} />
    </div>
  );
}

const DONUT_COLORS = ["var(--accent)", "var(--red)", "var(--live)", "var(--amber)", "#3b82f6", "#a855f7", "#14b8a6", "#f97316"];

/** A split as a ring; tap a slice (or its legend row) to read it. */
export function DonutChart({ slices = [], unit = "", decimals = 0 }) {
  const [sel, setSel] = useState(null);
  const total = slices.reduce((a, s) => a + s.y, 0) || 1;
  const R = 70;
  const r = 44;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const a1 = a0 + (s.y / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang, rad) => `${100 + rad * Math.cos(ang)} ${100 + rad * Math.sin(ang)}`;
    const d = slices.length === 1 ? `M ${p(0, R)} A ${R} ${R} 0 1 1 ${p(Math.PI, R)} A ${R} ${R} 0 1 1 ${p(0, R)} M ${p(0, r)} A ${r} ${r} 0 1 0 ${p(Math.PI, r)} A ${r} ${r} 0 1 0 ${p(0, r)} Z` : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    a0 = a1;
    return { d, color: DONUT_COLORS[i % DONUT_COLORS.length], s, i };
  });
  const cur = sel != null ? slices[sel] : null;
  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" className="donut-svg" role="img" aria-label="Donut chart">
        {arcs.map((a) => (
          <path key={a.i} d={a.d} fill={a.color} fillRule="evenodd" opacity={sel != null && sel !== a.i ? 0.35 : 1} onClick={() => setSel(sel === a.i ? null : a.i)} style={{ cursor: "pointer" }} />
        ))}
        <text x="100" y="98" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)">
          {cur ? `${fmtNum(cur.y, decimals)}${unit}` : fmtNum(total, decimals)}
        </text>
        <text x="100" y="118" textAnchor="middle" fontSize="11" fill="var(--muted)">
          {cur ? `${Math.round((cur.y / total) * 100)}% · ${String(cur.label).slice(0, 14)}` : "Total"}
        </text>
      </svg>
      <ul className="donut-legend">
        {arcs.map((a) => (
          <li key={a.i}>
            <button type="button" onClick={() => setSel(sel === a.i ? null : a.i)} aria-pressed={sel === a.i}>
              <i style={{ background: a.color }} />
              <span>{a.s.label}</span>
              <b>{fmtNum(a.s.y, decimals)}{unit}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two to four headline numbers. */
export function StatCards({ items = [] }) {
  return (
    <div className="ai-stat-cards" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <div key={it.label} className="ai-stat-card">
          <b>{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

// stylised ring radii (real proportions make the treble and double rings
// too thin to read on a phone)
const HR = { bullIn: 8, bullOut: 17, tIn: 58, tOut: 72, dIn: 86, dOut: 100 };

function sector(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`;
}

/**
 * Where darts landed, on a dartboard: each bed shaded by how many darts hit
 * it (singles share a count, as the log doesn't say inner or outer). Tap a
 * bed to read it. `cells` is { "20": { S, D, T }, "25": { S, D } }.
 */
export function DartHeatmap({ cells = {}, darts = 0, misses = 0, missLabel = "missed" }) {
  const [sel, setSel] = useState(null);
  const C = 120;
  const get = (n, ring) => cells[String(n)]?.[ring] || 0;
  let max = 1;
  for (const c of Object.values(cells)) max = Math.max(max, c.S || 0, c.D || 0, c.T || 0);
  const shade = (v) => (v ? `color-mix(in srgb, var(--accent) ${Math.round(12 + 88 * (v / max))}%, var(--surface))` : "var(--surface-2)");
  const beds = [];
  ORDER.forEach((n, i) => {
    const a0 = ((i * 18 - 9) * Math.PI) / 180;
    const a1 = ((i * 18 + 9) * Math.PI) / 180;
    beds.push({ key: `S${n}i`, label: `S${n}`, v: get(n, "S"), d: sector(C, C, HR.bullOut, HR.tIn, a0, a1) });
    beds.push({ key: `T${n}`, label: `T${n}`, v: get(n, "T"), d: sector(C, C, HR.tIn, HR.tOut, a0, a1) });
    beds.push({ key: `S${n}o`, label: `S${n}`, v: get(n, "S"), d: sector(C, C, HR.tOut, HR.dIn, a0, a1) });
    beds.push({ key: `D${n}`, label: `D${n}`, v: get(n, "D"), d: sector(C, C, HR.dIn, HR.dOut, a0, a1) });
  });
  const cur = sel ? beds.find((b) => b.key === sel) || (sel === "25" ? { label: "25", v: get(25, "S") } : sel === "BULL" ? { label: "Bull", v: get(25, "D") } : null) : null;
  return (
    <div className="heatmap">
      <svg viewBox="0 0 240 240" className="heatmap-svg" role="img" aria-label="Dartboard heatmap of where darts landed">
        <circle cx={C} cy={C} r={HR.dOut + 18} fill="var(--surface-2)" />
        {beds.map((b) => (
          <path key={b.key} d={b.d} fill={shade(b.v)} stroke="var(--surface)" strokeWidth={0.8} onClick={() => setSel(sel === b.key ? null : b.key)} style={{ cursor: "pointer" }} />
        ))}
        <circle cx={C} cy={C} r={HR.bullOut} fill={shade(get(25, "S"))} stroke="var(--surface)" strokeWidth="0.8" onClick={() => setSel(sel === "25" ? null : "25")} style={{ cursor: "pointer" }} />
        <circle cx={C} cy={C} r={HR.bullIn} fill={shade(get(25, "D"))} stroke="var(--surface)" strokeWidth="0.8" onClick={() => setSel(sel === "BULL" ? null : "BULL")} style={{ cursor: "pointer" }} />
        {/* the selected bed's outline, drawn on top of every bed */}
        {sel && beds.find((b) => b.key === sel) && <path d={beds.find((b) => b.key === sel).d} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" pointerEvents="none" />}
        {sel === "25" && <circle cx={C} cy={C} r={HR.bullOut} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />}
        {sel === "BULL" && <circle cx={C} cy={C} r={HR.bullIn} fill="none" stroke="var(--ink)" strokeWidth="2" pointerEvents="none" />}
        {ORDER.map((n, i) => {
          const a = (i * 18 * Math.PI) / 180;
          return (
            <text key={n} x={C + (HR.dOut + 10) * Math.sin(a)} y={C - (HR.dOut + 10) * Math.cos(a) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink-soft)">
              {n}
            </text>
          );
        })}
      </svg>
      <div className="heatmap-read" role="status" aria-live="polite">
        {cur ? (
          <>
            <b>{cur.label}</b> · {cur.v} {cur.v === 1 ? "dart" : "darts"}
            {darts ? ` (${Math.round((cur.v / darts) * 100)}%)` : ""}
          </>
        ) : (
          <>
            {darts} darts · {misses} {missLabel}{darts ? ` (${Math.round((misses / darts) * 100)}%)` : ""}. Tap a bed.
          </>
        )}
      </div>
    </div>
  );
}
