/**
 * Haptics and sounds for scoring (Settings → Accessibility).
 *
 * Haptics use the Vibration API, which Android browsers support; iPhone
 * Safari has no vibration API, so there this is a silent no-op. Sounds are
 * short tones synthesised with Web Audio (no files), created lazily on the
 * first sound so nothing loads unless sounds are switched on.
 *
 * Kinds: "dart" (each dart entered), "bust", "big" (checkout, 180, win).
 */

let prefs = { haptics: true, sounds: false };

export function setFeedbackPrefs(p = {}) {
  prefs = {
    haptics: p.haptics === undefined ? prefs.haptics : !!p.haptics,
    sounds: p.sounds === undefined ? prefs.sounds : !!p.sounds,
  };
}

export function getFeedbackPrefs() {
  return { ...prefs };
}

/** Vibration pattern per kind (ms on/off). */
export const HAPTICS = { dart: 12, bust: [35, 60, 35], big: [60, 40, 140] };

/** Tone sequence per kind: [frequency Hz, duration s] steps. */
export const TONES = {
  dart: [[1320, 0.035]],
  bust: [[196, 0.12], [147, 0.18]],
  big: [[660, 0.09], [880, 0.09], [1175, 0.18]],
};

/** Which feedback a celebration overlay should give. */
export function kindForCelebration(type) {
  if (type === "halved" || type === "reset" || type === "bust") return "bust";
  if (type === "180" || type === "win" || type === "checkout" || type === "shanghai" || type === "badge") return "big";
  return null;
}

let ctx = null;
function playTones(steps) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of steps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.9;
    }
  } catch {
    /* audio unavailable: stay silent */
  }
}

export function feedback(kind) {
  if (typeof window === "undefined" || !HAPTICS[kind]) return;
  if (prefs.haptics && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(HAPTICS[kind]);
    } catch {}
  }
  if (prefs.sounds) playTones(TONES[kind]);
}
