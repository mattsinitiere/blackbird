/**
 * Undo for the party games that commit a visit the moment its third dart
 * lands (Killer, Shanghai, Halve It, Gotcha, Tic-Tac-Toe). Pure: no React.
 *
 * Each committed visit pushes one history entry: the state before the
 * visit plus the darts to put back if it is undone. When the third dart
 * (or a bust or winning dart) ended the visit, that dart is the mistake
 * Undo is meant to fix, so only it is dropped and the visit reopens with
 * the darts before it still in place. A visit ended with the End turn
 * button reopens whole: Undo takes back the End turn tap.
 */

/** The history entry for a visit about to be committed. */
export function visitEntry({ s, turn, by, darts = [], auto = true }) {
  return {
    s: JSON.parse(JSON.stringify(s)),
    turn,
    by,
    darts: auto ? darts.slice(0, -1) : darts.slice(),
  };
}

/**
 * Step back one visit. `skip(entry)` marks entries Undo should pass over
 * on the way (a bot's visit: undoing it would only make the bot throw the
 * same visit again). Returns { entry, history } with the entry to restore
 * and the history left, or null when there is nothing to undo.
 * Entries saved before the darts were kept reopen empty.
 */
export function undoVisit(history, { skip } = {}) {
  let i = (history || []).length - 1;
  while (i >= 0 && skip && skip(history[i])) i--;
  if (i < 0) return null;
  const e = history[i];
  return { entry: { ...e, darts: Array.isArray(e.darts) ? e.darts : [] }, history: history.slice(0, i) };
}
