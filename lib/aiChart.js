/**
 * The chart protocol between Blackbird AI and the chat UI.
 *
 * The model answers in prose and may append up to three fenced blocks:
 *
 *   ```chart
 *   { "type": "line", "title": "Checkout % by month", "unit": "%",
 *     "series": "checkoutPctByMonth" }
 *   ```
 *
 * `series` names stored data (a key from the player's summary, or an id a
 * tool returned such as "s1"), so the numbers drawn are the app's, not the
 * model's. An array of up to four ids draws a comparison. Types:
 *   line, bar         one or more series (several = a comparison)
 *   stackedBar        several series stacked per period
 *   donut             one series or `points` [{label, y}] as slices
 *   heatmap           `heatmap`: an id from the dart_heatmap tool
 *   stats             `items`: up to four [{label, value}] stat cards
 * Ad-hoc `points` [{label, y}] are still accepted for small comparisons.
 * Pure: shared by the API route (extract + resolve) and the chat UI.
 */

const FENCE = /```(?:chart|json)?[ \t]*\r?\n([\s\S]*?)```/g;
const COLORS = { accent: "var(--accent)", live: "var(--live)", amber: "var(--amber)", red: "var(--red)" };
export const PALETTE = ["var(--accent)", "var(--red)", "var(--live)", "var(--amber)", "#3b82f6"];
const MAX_POINTS = 200;
export const MAX_CHARTS = 3;
const TYPES = ["line", "bar", "stackedBar", "donut", "heatmap", "stats"];

function parseBlock(raw) {
  try {
    const obj = JSON.parse(raw.trim());
    if (obj && typeof obj === "object") return obj.chart && typeof obj.chart === "object" ? obj.chart : obj;
  } catch {}
  return null;
}

const isChart = (o) => o && (o.series || o.points || o.heatmap || o.items);

/**
 * Pull up to MAX_CHARTS chart blocks out of a model reply.
 * @returns {{ text: string, charts: object[] }}
 */
export function extractCharts(text) {
  const src = (text || "").toString();
  const charts = [];
  const cleaned = src
    .replace(FENCE, (m, body) => {
      const obj = parseBlock(body);
      if (isChart(obj)) {
        if (charts.length < MAX_CHARTS) charts.push(obj);
        return "";
      }
      return m;
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: cleaned, charts };
}

/** First chart only (the original one-chart protocol). */
export function extractChart(text) {
  const { text: t, charts } = extractCharts(text);
  return { text: t, chart: charts[0] || null };
}

function num(v) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function cleanPoints(points) {
  return (points || [])
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
        if (num(p.n) != null) out.n = num(p.n);
      }
      return out;
    })
    .filter(Boolean);
}

/** Stored series by key: plain arrays (summary) or { name, points } (tools). */
function lookup(store, key) {
  if (typeof key !== "string" || !store) return null;
  const v = store[key];
  if (Array.isArray(v)) return { name: null, points: v };
  if (v && Array.isArray(v.points)) return { name: v.name || null, points: v.points };
  return null;
}

const keyOf = (p) => p.label || p.date || `#${p.x}`;

/** Put several series on one shared x axis, matched by label or date. */
function align(sets) {
  const keys = [];
  const seen = new Set();
  for (const s of sets)
    for (const p of s.points) {
      const k = keyOf(p);
      if (!seen.has(k)) {
        seen.add(k);
        keys.push({ k, date: p.date, label: p.label || p.date });
      }
    }
  if (keys.every((k) => k.date)) keys.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const idx = new Map(keys.map((k, i) => [k.k, i + 1]));
  return {
    labels: keys.map((k) => k.label || ""),
    sets: sets.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, x: idx.get(keyOf(p)) })).sort((a, b) => a.x - b.x) })),
  };
}

/**
 * Validate a chart block and turn it into renderable data.
 * @param {object} chart     the parsed block
 * @param {object} series    stored series ({ key: points[] | { name, points } })
 * @param {object} heatmaps  heatmaps from the dart_heatmap tool ({ id: {...} })
 */
export function resolveChart(chart, series, heatmaps = {}) {
  if (!chart || typeof chart !== "object") return null;
  const type = TYPES.includes(chart.type) ? chart.type : "line";
  const title = (chart.title || "").toString().slice(0, 80);
  const unit = (chart.unit || "").toString().slice(0, 6);
  const decimals = Math.min(2, Math.max(0, parseInt(chart.decimals, 10) || 0));

  if (type === "heatmap") {
    const h = heatmaps && typeof chart.heatmap === "string" ? heatmaps[chart.heatmap] : null;
    if (!h) return null;
    return { type, title, cells: h.counts, darts: h.darts, misses: h.misses };
  }

  if (type === "stats") {
    const items = (Array.isArray(chart.items) ? chart.items : [])
      .filter((i) => i && i.label != null && i.value != null && String(i.value).trim())
      .slice(0, 4)
      .map((i) => ({ label: String(i.label).slice(0, 24), value: String(i.value).slice(0, 14) }));
    return items.length ? { type, title, items } : null;
  }

  // one or more series (or ad-hoc points)
  const keys = Array.isArray(chart.series) ? chart.series.slice(0, 4) : chart.series ? [chart.series] : [];
  const names = Array.isArray(chart.names) ? chart.names : [];
  let sets = keys
    .map((k, i) => {
      const s = lookup(series, k);
      return s ? { name: (names[i] || s.name || "").toString().slice(0, 24), points: cleanPoints(s.points) } : null;
    })
    .filter((s) => s && s.points.length);
  if (!sets.length && Array.isArray(chart.points)) sets = [{ name: "", points: cleanPoints(chart.points) }];
  const last = parseInt(chart.last, 10);
  sets = sets
    .map((s) => {
      let pts = s.points;
      if (last > 0 && pts.length > last) pts = pts.slice(-last);
      if (pts.length > MAX_POINTS) pts = pts.slice(-MAX_POINTS);
      return { ...s, points: pts };
    })
    .filter((s) => s.points.length);
  if (!sets.length) return null;

  if (type === "donut") {
    const slices = sets[0].points
      .filter((p) => p.y > 0)
      .slice(0, 8)
      .map((p, i) => ({ label: p.label || p.date || `#${i + 1}`, y: p.y }));
    return slices.length ? { type, title, unit, decimals, slices } : null;
  }

  const color = COLORS[chart.color] || COLORS.accent;
  if (sets.length === 1 && type !== "stackedBar") {
    // the single-series shape the chat has always stored
    return { type, title, unit, decimals, color, points: sets[0].points };
  }
  const { labels, sets: aligned } = align(sets);
  return {
    type,
    title,
    unit,
    decimals,
    labels,
    datasets: aligned.map((s, i) => ({ name: s.name || `Series ${i + 1}`, color: PALETTE[i % PALETTE.length], points: s.points })),
  };
}

/** Resolve every block, dropping the ones that don't validate. */
export function resolveCharts(charts, series, heatmaps) {
  return (charts || [])
    .slice(0, MAX_CHARTS)
    .map((c) => resolveChart(c, series, heatmaps))
    .filter(Boolean);
}
