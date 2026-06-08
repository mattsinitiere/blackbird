import { useState } from "react";
import { BackBar } from "./ui";
import { supabase } from "@/lib/supabase";
import { headToHead } from "@/lib/stats";

function round(n, d = 0) {
  const f = Math.pow(10, d);
  return Math.round((n || 0) * f) / f;
}

function playerRow(u, stats, elo) {
  const s = stats[u];
  return {
    name: u,
    elo: Math.round(elo[u] || 1500),
    games: s.games,
    wins: s.wins,
    winPct: round(s.winPct),
    x01ThreeDartAvg: round(s.x01.threeDartAvg, 1),
    x01Record: `${s.x01.wins}-${s.x01.games - s.x01.wins}`,
    bestLeg: s.x01.bestLeg,
    highestCheckout: s.x01.highestCheckout,
    highestTurn: s.x01.highestTurn,
    cricketMPR: round(s.cricket.mpr, 2),
    cricketRecord: `${s.cricket.wins}-${s.cricket.games - s.cricket.wins}`,
  };
}

export default function Insights({ usernames, stats, elo, matches, back }) {
  const known = usernames.filter((u) => stats[u]);
  const [kind, setKind] = useState("league");
  const [a, setA] = useState(known[0] || "");
  const [b, setB] = useState(known[1] || "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");

  const buildSummary = () => {
    if (kind === "player") {
      const ranked = [...known].sort((x, y) => (elo[y] || 1500) - (elo[x] || 1500));
      return {
        focusPlayer: playerRow(a, stats, elo),
        leagueRankOfFocus: ranked.indexOf(a) + 1,
        leagueSize: known.length,
        totalGames: matches.length,
      };
    }
    if (kind === "matchup") {
      const Ra = elo[a] || 1500;
      const Rb = elo[b] || 1500;
      const h2h = headToHead(matches, a, b);
      return {
        playerA: playerRow(a, stats, elo),
        playerB: playerRow(b, stats, elo),
        eloWinProbabilityA: round(1 / (1 + Math.pow(10, (Rb - Ra) / 400)), 2),
        headToHead: { aWins: h2h.aw, bWins: h2h.bw, gamesPlayed: h2h.n },
      };
    }
    return {
      totalGames: matches.length,
      players: known.map((u) => playerRow(u, stats, elo)),
    };
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    setResult("");
    setModel("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ kind, summary: buildSummary() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data.text);
      setModel(data.model || "");
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const canGenerate =
    known.length > 0 &&
    (kind === "league" ||
      (kind === "player" && a) ||
      (kind === "matchup" && a && b && a !== b));

  return (
    <div className="fade">
      <BackBar back={back} title="AI insights" />

      {known.length === 0 ? (
        <p className="subtle">Log a few games first — the AI needs data to analyse.</p>
      ) : (
        <>
          <div className="card mb-12">
            <div className="row mb-12">
              {[
                ["league", "League"],
                ["player", "Player"],
                ["matchup", "Matchup"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={`btn ${kind === k ? "btn-primary" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setKind(k);
                    setResult("");
                    setError("");
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {kind === "player" && (
              <select className="select" value={a} onChange={(e) => setA(e.target.value)}>
                {known.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            )}

            {kind === "matchup" && (
              <div className="row">
                <select className="select" value={a} onChange={(e) => setA(e.target.value)}>
                  {known.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <select className="select" value={b} onChange={(e) => setB(e.target.value)}>
                  {known.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-primary mt-12"
              style={{ width: "100%", padding: 14 }}
              onClick={generate}
              disabled={busy || !canGenerate}
            >
              {busy ? "Analysing…" : "Generate insight"}
            </button>
          </div>

          {error && (
            <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
              <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>
                {error}
              </p>
            </div>
          )}

          {result && (
            <div className="card fade">
              <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{result}</p>
              {model && (
                <div className="tag" style={{ marginTop: 12 }}>
                  generated by {model}
                </div>
              )}
            </div>
          )}

          {!result && !error && !busy && (
            <p className="tag" style={{ textTransform: "none", letterSpacing: 0, lineHeight: 1.5 }}>
              Insights are written by your configured AI provider from the league&apos;s real
              stats. Pick a focus and generate.
            </p>
          )}
        </>
      )}
    </div>
  );
}
