import { LineChart, BarChart, MultiLineChart, GroupedBarChart, DonutChart, StatCards, DartHeatmap } from "./Charts";

/**
 * One chart Blackbird AI attached to a reply (resolved by lib/aiChart.js,
 * so every number is the app's own). Used by the chat and match reports.
 */
export default function AIChart({ chart }) {
  if (!chart) return null;
  let body = null;
  if (chart.type === "stats" && chart.items?.length) body = <StatCards items={chart.items} />;
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
