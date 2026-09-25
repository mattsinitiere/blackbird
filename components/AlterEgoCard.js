import { useMemo, useState } from "react";
import { buildProfile, describeProfile, frozenConfig, MODES, MODE_LABELS, WINDOWS, WINDOW_LABELS, ALTER_EGO_ID, ALTER_EGO_MIN, ALTER_EGO_MIN_ROUNDS } from "@/lib/alterEgo";
import { newGameId } from "@/lib/games";

const INTRO = {
  x01: "Play 501 against an approximation of your own recorded form. It's a statistical stand-in built from your scoring and checkout numbers, not a copy of how you throw.",
  cricket: "Play Cricket against an approximation of your own marks per round. It aims like the Blackbird bots, so the way it chooses numbers is standard strategy, not yours.",
  baseball: "Play Baseball against an approximation of your own runs per inning, always aiming at the treble of the inning's number.",
};

const START_CONFIG = {
  x01: { startScore: 501, doubleOut: true, legs: 1 },
  cricket: { variant: "standard" },
  baseball: {},
};

function needText(mode) {
  if (mode === "x01") return `at least ${ALTER_EGO_MIN.games} X01 games with dart logs, ${ALTER_EGO_MIN.scoringDarts} scoring darts and ${ALTER_EGO_MIN.checkoutChances} checkout darts`;
  const unit = mode === "cricket" ? "rounds" : "innings";
  return `at least ${ALTER_EGO_MIN_ROUNDS.games} ${MODE_LABELS[mode]} games and ${ALTER_EGO_MIN_ROUNDS.rounds} ${unit}`;
}

function coverageText(mode, p) {
  const cov = p.coverage;
  if (!p.ok || !cov) return null;
  const skipped = cov.rowsWithoutLogs ? ` · ${cov.rowsWithoutLogs} game${cov.rowsWithoutLogs === 1 ? "" : "s"} in range had no usable stats and weren't used` : "";
  if (mode === "x01") return `${p.games} games · ${p.scoringDarts} scoring darts · ${p.checkoutChances} checkout darts${skipped}`;
  return `${p.games} games · ${p.rounds} ${mode === "cricket" ? "rounds" : "innings"}${skipped}`;
}

/**
 * Alter Ego: an X01, Cricket or Baseball opponent built from the player's
 * own recorded form in a chosen window (lib/alterEgo.js). The profile is
 * computed here from rows already on the device and frozen into the game
 * when it starts, so play needs no network and difficulty never drifts
 * mid-match. Only the selected mode is calibrated.
 */
export default function AlterEgoCard({ rows, me, onStartGame }) {
  const [mode, setMode] = useState("x01");
  const [win, setWin] = useState("last10");
  const profiles = useMemo(() => Object.fromEntries(WINDOWS.map((w) => [w, buildProfile(rows || [], { me, window: w, mode })])), [rows, me, mode]);
  const okWindows = WINDOWS.filter((w) => profiles[w].ok);
  // keep the chosen window when it works in the new mode, else the first that does
  const active = profiles[win].ok || !okWindows.length ? win : okWindows[0];
  const p = profiles[active];
  const start = () => {
    if (!p.ok) return;
    onStartGame({
      id: newGameId(),
      gameType: mode,
      players: [me, ALTER_EGO_ID],
      config: { ...START_CONFIG[mode], alterEgo: frozenConfig(p) },
      startedAt: new Date().toISOString(),
    });
  };
  const cov = coverageText(mode, p);
  return (
    <section className="card mb-12 alter-ego" aria-labelledby="ae-title">
      <h3 className="section-title" id="ae-title">Alter Ego</h3>
      <div className="plan-choice" role="radiogroup" aria-label="Game">
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} className={`plan-chip${mode === m ? " is-on" : ""}`} onClick={() => setMode(m)}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <p className="tag plans-note">{INTRO[mode]} Practice only.</p>
      {okWindows.length ? (
        <>
          <div className="plan-choice" role="radiogroup" aria-label="Which of your games">
            {WINDOWS.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={active === w} className={`plan-chip${active === w ? " is-on" : ""}`} onClick={() => setWin(w)} disabled={!profiles[w].ok}>
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
          <p className="ae-desc">{describeProfile(p)}</p>
          {cov && <p className="ae-cov">{cov}</p>}
          <button type="button" className="btn btn-primary" style={{ width: "100%", minHeight: 46 }} disabled={!p.ok} onClick={start}>
            Play Alter Ego
          </button>
        </>
      ) : (
        <p className="ae-desc" role="status">
          Not enough history yet. Alter Ego needs {needText(mode)}. So far: {describeProfile(profiles.last10).replace(/^Not enough .*? yet: /, "")}
        </p>
      )}
    </section>
  );
}
