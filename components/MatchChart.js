import { useMemo } from "react";
import { MultiLineChart, GroupedBarChart } from "./Charts";
import { analyzeMatch, rowsFromMatch } from "@/lib/gamestats";
import { defaultPlayerColor } from "@/lib/constants";
import { playerLabel } from "@/lib/bots";

// the most telling series per game mode, and how to draw it
const PICK = {
  x01: { key: "remaining", title: "Race to Zero", type: "line", fallback: "visitScores" },
  cricket: { key: "marksPerRound", title: "Marks per Round", type: "bar" },
  baseball: { key: "runsPerInning", title: "Runs per Inning", type: "bar" },
  aroundTheClock: { key: "progress", title: "Race Around the Board", type: "line" },
  killer: { key: "lives", title: "Lives Left", type: "line" },
  shanghai: { key: "roundScores", title: "Score per Round", type: "bar" },
  halveit: { key: "score", title: "Score Through the Game", type: "line" },
  gotcha: { key: "score", title: "Score Through the Game", type: "line" },
  bobs27: { key: "score", title: "Score by Round", type: "line" },
  checkoutDrill: { key: "dartsPerFinish", title: "Darts per Finish", type: "bar" },
  scoringDrill: { key: "visitScores", title: "Score per Visit", type: "bar" },
};

/**
 * The recap's chart: how the game unfolded for each player, from the dart
 * log (lib/gamestats). Nothing renders when the game has no usable log.
 */
export default function MatchChart({ match, playerColors }) {
  const data = useMemo(() => {
    const pick = PICK[match?.gameType];
    if (!pick) return null;
    const m = analyzeMatch(rowsFromMatch(match));
    if (!m) return null;
    const names = Object.keys(m.players);
    const key = names.some((u) => m.players[u].series?.[pick.key]?.length > 1) ? pick.key : pick.fallback;
    if (!key) return null;
    // the X01 race starts from the starting score
    const race = key === "remaining";
    const start = match.config?.startScore || 501;
    const datasets = names
      .map((u) => {
        let pts = (m.players[u].series?.[key] || []).filter((p) => p && p.y != null).map(({ y }) => ({ y }));
        if (race) pts = [{ y: start }, ...pts];
        return { name: playerLabel(u), color: playerColors?.[u] || defaultPlayerColor(u), points: pts.map((p, i) => ({ ...p, x: i + 1 })) };
      })
      .filter((d) => d.points.length > 1);
    if (!datasets.length) return null;
    const n = Math.max(...datasets.map((d) => d.points.length));
    const raw = names.map((u) => m.players[u].series?.[key] || []);
    const labels = Array.from({ length: n }, (_, i) => {
      if (race) return i === 0 ? "Start" : `Visit ${i}`;
      const l = raw.find((r) => r[i]?.label)?.[i]?.label;
      return l && !/^L\d+$/.test(l) ? l : pick.type === "bar" ? String(i + 1) : `Round ${i + 1}`;
    });
    return { ...pick, title: key === pick.key ? pick.title : "Score per Visit", datasets, labels };
  }, [match, playerColors]);
  if (!data) return null;
  return (
    <div className="card mb-12">
      <h3 className="section-title">{data.title}</h3>
      {data.type === "bar" ? <GroupedBarChart labels={data.labels} datasets={data.datasets} /> : <MultiLineChart labels={data.labels} datasets={data.datasets} />}
    </div>
  );
}
