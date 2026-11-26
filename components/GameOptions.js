import { CRICKET_VARIANTS } from "@/lib/constants";

/**
 * Game options shared by the New Game screen and the Play a Bot screen, so
 * both offer the same settings with the same defaults.
 */

export function X01Options({ startScore, setStartScore, doubleOut, setDoubleOut, legs, setLegs }) {
  return (
    <div className="mt-12">
      <div className="tag" style={{ marginBottom: 6 }}>
        Starting Score
      </div>
      <div className="row">
        {[301, 501, 701].map((v) => (
          <button
            key={v}
            className={`btn ${startScore === v ? "btn-toggle-on" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setStartScore(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={doubleOut}
          onChange={(e) => setDoubleOut(e.target.checked)}
        />
        <span>Double out (your last dart must be a double, e.g. D16 or Bull)</span>
      </label>
      <div className="tag" style={{ marginTop: 12, marginBottom: 6 }}>Legs</div>
      <div className="row">
        {[1, 3, 5, 7].map((v) => (
          <button
            key={v}
            className={`btn ${legs === v ? "btn-toggle-on" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setLegs(v)}
            aria-label={v === 1 ? "Single leg" : `Best of ${v} legs`}
          >
            {v === 1 ? "Single" : `BO${v}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CricketOptions({ variant, setVariant }) {
  return (
    <div className="mt-12">
      <div className="tag" style={{ marginBottom: 6 }}>
        Variant
      </div>
      <div className="row">
        {CRICKET_VARIANTS.map((v) => (
          <button
            key={v.id}
            className={`btn ${variant === v.id ? "btn-toggle-on" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setVariant(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
        {variant === "standard" && "Close all numbers and lead on points to win."}
        {variant === "cutthroat" && "Points go to opponents — lowest score wins."}
        {variant === "noscore" && "First to close all numbers wins. Points ignored."}
      </p>
    </div>
  );
}

export function BaseballNote() {
  return (
    <p className="tag mt-12" style={{ textTransform: "none", letterSpacing: 0 }}>
      9 innings. In inning N you aim at number N; single/double/triple = 1/2/3 runs.
      Most runs after 9 innings wins. If the lead is shared, only the tied leaders play
      extra innings until one of them is ahead.
    </p>
  );
}

export const KILLER_LIVES = [3, 5, 7];

export function KillerOptions({ lives, setLives }) {
  return (
    <div className="mt-12">
      <div className="tag" style={{ marginBottom: 6 }}>Lives</div>
      <div className="row">
        {KILLER_LIVES.map((v) => (
          <button key={v} type="button" className={`btn ${lives === v ? "btn-toggle-on" : ""}`} style={{ flex: 1 }} onClick={() => setLives(v)} aria-pressed={lives === v}>
            {v}
          </button>
        ))}
      </div>
      <p className="tag" style={{ marginTop: 8, textTransform: "none", letterSpacing: 0 }}>
        Each player gets a random number. Hit your own double to become a killer,
        then hit opponents&apos; doubles to take their lives. Last one standing wins.
      </p>
    </div>
  );
}
