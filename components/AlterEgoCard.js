import { useMemo, useState } from "react";
import { buildProfile, describeProfile, frozenConfig, WINDOWS, WINDOW_LABELS, ALTER_EGO_ID, ALTER_EGO_MIN } from "@/lib/alterEgo";
import { newGameId } from "@/lib/games";

/**
 * Alter Ego: an X01 opponent built from the player's own recorded form in
 * a chosen window (lib/alterEgo.js). The profile is computed here from
 * rows already on the device and frozen into the game when it starts, so
 * play needs no network and difficulty never drifts mid-match.
 */
export default function AlterEgoCard({ rows, me, onStartGame }) {
  const [win, setWin] = useState("last10");
  const profiles = useMemo(() => Object.fromEntries(WINDOWS.map((w) => [w, buildProfile(rows || [], { me, window: w })])), [rows, me]);
  const p = profiles[win];
  const anyOk = WINDOWS.some((w) => profiles[w].ok);
  const start = () => {
    if (!p.ok) return;
    onStartGame({
      id: newGameId(),
      gameType: "x01",
      players: [me, ALTER_EGO_ID],
      config: { startScore: 501, doubleOut: true, legs: 1, alterEgo: frozenConfig(p) },
      startedAt: new Date().toISOString(),
    });
  };
  const cov = p.coverage;
  return (
    <section className="card mb-12 alter-ego" aria-labelledby="ae-title">
      <h3 className="section-title" id="ae-title">Alter Ego</h3>
      <p className="tag plans-note">Play 501 against an approximation of your own recorded form. It's a statistical stand-in built from your scoring and checkout numbers, not a copy of how you throw. Practice only.</p>
      {anyOk ? (
        <>
          <div className="plan-choice" role="radiogroup" aria-label="Which of your games">
            {WINDOWS.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={win === w} className={`plan-chip${win === w ? " is-on" : ""}`} onClick={() => setWin(w)} disabled={!profiles[w].ok}>
                {WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
          <p className="ae-desc">{describeProfile(p)}</p>
          {p.ok && cov && (
            <p className="ae-cov">
              {p.games} games · {p.scoringDarts} scoring darts · {p.checkoutChances} checkout darts
              {cov.rowsWithoutLogs ? ` · ${cov.rowsWithoutLogs} game${cov.rowsWithoutLogs === 1 ? "" : "s"} in range had no dart log and weren't used` : ""}
            </p>
          )}
          <button type="button" className="btn btn-primary" style={{ width: "100%", minHeight: 46 }} disabled={!p.ok} onClick={start}>
            Play Alter Ego
          </button>
        </>
      ) : (
        <p className="ae-desc" role="status">
          Not enough history yet. Alter Ego needs at least {ALTER_EGO_MIN.games} X01 games with dart logs, {ALTER_EGO_MIN.scoringDarts} scoring darts and {ALTER_EGO_MIN.checkoutChances} checkout darts. {describeProfile(profiles.last10)}
        </p>
      )}
    </section>
  );
}
