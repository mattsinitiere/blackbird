import { useEffect } from "react";

/**
 * Drives a bot's visit one dart at a time. Whenever `active` is true and
 * `key` changes (the caller derives it from turn + darts thrown so far),
 * `throwOne` fires after `delayMs`. Each throw updates component state,
 * which changes the key and re-arms the timer, so the bot throws through
 * the very same dart handler a person taps, and every rule, celebration,
 * undo snapshot and TV cast update comes for free. Unmount or a change of
 * turn clears the pending throw.
 */
export function useBotTurn({ active, key, throwOne, delayMs = 750 }) {
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(throwOne, delayMs);
    return () => clearTimeout(t);
    // throwOne is a fresh closure every render on purpose: it must read
    // the latest state; `key` is what decides when to re-arm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, delayMs]);
}
