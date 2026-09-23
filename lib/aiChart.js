/**
 * The chart protocol between Blackbird AI and the chat UI.
 *
 * The model answers in prose and may append one fenced block:
 *
 *   ```chart
 *   { "type": "line", "title": "Checkout % by month", "unit": "%",
 *     "series": "checkoutPctByMonth" }
 *   ```
 *
 * `series` names a pre-computed series from the player's summary (so the
 * numbers are the app's, not the model's), optionally trimmed with
 * `"last": N`. A `points` array of { x?, y, date?, label? } is accepted
 * instead for ad-hoc comparisons the model computed from the data.
 * Pure: shared by the API route (extract) and the chat UI (resolve).
 */

const FENCE = /```(?:chart|json)?[ \t]*\r?\n([\s\S]*?)```/g;
const COLORS = { accent: "var(--accent)", live: "var(--live)", amber: "var(--amber)", red: "var(--red)" };
const MAX_POINTS = 200;

function parseBlock(raw) {
  try {
    const obj = JSON.parse(raw.trim());
    if (obj && typeof obj === "object") return obj.chart && typeof obj.chart === "object" ? obj.chart : obj;
  } catch {}
  return null;
}

/**
 * Pull the chart block out of a model reply.
 * @returns {{ text: string, chart: object|null }}
 */
export function extractChart(text) {
  const src = (text || "").toString();
  let chart = null;
  const cleaned = src
    .replace(FENCE, (m, body) => {
      const obj = parseBlock(body);
      if (obj && !chart && (obj.series || obj.points)) {
        chart = obj;
        return "";
      }
      return m;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: cleaned, chart };
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate a chart block and turn it into renderable points.
 * @param {object} chart  the parsed block
 * @param {object} series the summary's named series ({ key: [{x,y,date,label}] })
 * @returns {{ type, title, unit, decimals, color, points }|null}
 */
export function resolveChart(chart, series) {
  if (!chart || typeof chart !== "object") return null;
  let points = null;
  if (typeof chart.series === "string" && series && Array.isArray(series[chart.series])) {
    points = series[chart.series];
  } else if (Array.isArray(chart.points)) {
    points = chart.points;
  }
  if (!points) return null;
  points = points
    .map((p, i) => {
      if (p == null) return null;
      const y = num(typeof p === "object" ? p.y : p);
      if (y == null) return null;
      const out = { x: i + 1, y };
      if (typeof p === "object") {
        const x = num(p.x);
        if (x != null) out.x = x;
        if (typeof p.date === "string" && !Number.isNaN(Date.parse(p.date))) out.date = p.date;
        if (p.label != null && String(p.label).trim()) out.label = String(p.label).slice(0, 24);
      }
      return out;
    })
    .filter(Boolean);
  const last = parseInt(chart.last, 10);
  if (last > 0 && points.length > last) points = points.slice(-last);
  if (points.length > MAX_POINTS) points = points.slice(-MAX_POINTS);
  if (!points.length) return null;
  const decimals = Math.min(2, Math.max(0, parseInt(chart.decimals, 10) || 0));
  const type = chart.type === "bar" ? "bar" : "line";
  return {
    type,
    title: (chart.title || "").toString().slice(0, 80),
    unit: (chart.unit || "").toString().slice(0, 6),
    decimals,
    color: COLORS[chart.color] || COLORS.accent,
    points,
  };
}
