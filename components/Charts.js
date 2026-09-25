import { useEffect, useRef, useState } from "react";

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
export function LineChart({ data, color = "var(--accent)", unit = "", decimals = 0, textScale = 1 }) {
  const W = 600;
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
