import { useMemo, useState } from "react";
import { recommend, routeLabel } from "@/lib/strategy/x01";
import { recommendCricket } from "@/lib/strategy/cricket";

const BASIS = {
  standard: "Standard route",
  preference: "Your preferred double",
  data: "Based on your drill results",
};

/**
 * X01 route advice for the score and darts left right now. Advisory: it
 * reads the game state and never changes it. Recomputed from scratch on
 * every dart, undo or turn change (lib/strategy/x01.js is pure).
 */
export function X01Hint({ remaining, dartsLeft, doubleOut, prefs, evidence }) {
  const [why, setWhy] = useState(false);
  const rec = useMemo(
    () =>
      recommend({
        remaining,
        dartsLeft,
        doubleOut,
        preferredDouble: prefs?.preferredDouble || null,
        evidence: prefs?.mode === "personalized" ? evidence : null,
      }),
    [remaining, dartsLeft, doubleOut, prefs, evidence]
  );
  if (!prefs || prefs.mode === "off" || rec.kind === "none" || !rec.route.length) return null;
  // setups for big scores are just "T20"; only show them close to a finish
  if (rec.kind === "setup" && remaining > 170 + 60) return null;
  const isOut = rec.kind === "checkout";
  return (
    <div className={`card pad-sm mb-12 hint-card${isOut ? " is-out" : ""}`} role="status" aria-live="polite">
      <div className="hint-row">
        <span className="hint-kind">{isOut ? "Checkout" : "Setup"}</span>
        <span className="hint-route num">{routeLabel(rec.route)}</span>
        <button type="button" className="hint-why" aria-expanded={why} onClick={() => setWhy((w) => !w)}>
          {why ? "Hide" : "Why this route?"}
        </button>
      </div>
      {rec.alternative && rec.alternative.length > 0 && <div className="hint-alt">or {routeLabel(rec.alternative)}</div>}
      {why && (
        <div className="hint-explain">
          <div className="hint-basis">{BASIS[rec.basis] || BASIS.standard}</div>
          <p>{rec.reason}</p>
          {rec.basis === "data" && rec.evidence && (
            <p>
              {rec.evidence.double}: {rec.evidence.hits} of {rec.evidence.attempts} in drills ({Math.round(rec.evidence.rate * 100)}%) vs {rec.evidence.versus.double}: {rec.evidence.versus.hits} of {rec.evidence.versus.attempts} ({Math.round(rec.evidence.versus.rate * 100)}%).
            </p>
          )}
          {prefs.mode === "personalized" && rec.basis === "standard" && <p>Not enough drill data yet to personalize this one.</p>}
        </div>
      )}
    </div>
  );
}

/** One line of Cricket advice from the current marks and points. */
export function CricketHint({ variant, me, players, state, prefs }) {
  const rec = useMemo(() => recommendCricket({ variant, me, players, state }), [variant, me, players, state]);
  if (!prefs || prefs.mode === "off" || !rec || rec.action === "done") return null;
  const label = rec.target === "B" ? "Bull" : rec.target;
  const verb = rec.action === "score" ? "Score on" : rec.action === "bull" ? "Go for the" : "Close";
  return (
    <div className="card pad-sm mb-12 hint-card" role="status" aria-live="polite">
      <div className="hint-row">
        <span className="hint-kind">Hint</span>
        <span className="hint-route">
          {verb} {label}
        </span>
      </div>
      <div className="hint-alt">{rec.reason}</div>
    </div>
  );
}
