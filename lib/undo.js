/**
 * Undo helpers shared by the play screens. Every screen keeps a history of
 * snapshots, one pushed at the start of each committed visit, holding the
 * state before it and the visit's turn index.
 */

/**
 * How many snapshots to pop so an undo lands on the last visit a person
 * threw. Bot visits are skipped: popping one would only make the bot throw
 * again with fresh darts, so a person could never reach (and fix) their
 * own previous visit, and could re-roll a bot's visit until it missed.
 * 0 when there is no person's visit to go back to.
 */
export function undoDepth(history, players, isBotPlayer) {
  for (let i = history.length - 1; i >= 0; i--) {
    const u = players[history[i].turn % players.length];
    if (!isBotPlayer(u)) return history.length - i;
  }
  return 0;
}

/**
 * The darts to put back in front of the player after undoing a committed
 * visit: all but the last, so one tap of Undo removes one dart.
 */
export function dartsAfterUndo(visitDarts) {
  return Array.isArray(visitDarts) ? visitDarts.slice(0, -1) : [];
}
