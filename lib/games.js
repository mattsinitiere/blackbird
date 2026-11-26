/** Game-setup helpers shared by the New Game screen and Rematch. */

export const KILLER_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Give each player a distinct random number 1–20. */
export function assignKillerNumbers(players) {
  const pool = [...KILLER_NUMBERS];
  const out = {};
  for (const p of players) {
    const idx = Math.floor(Math.random() * pool.length);
    out[p] = pool.splice(idx, 1)[0];
  }
  return out;
}

export function newGameId() {
  return Date.now().toString(36);
}

/**
 * Who throws first next time. Two players: the loser starts (or the order
 * simply swaps when there was no winner). Three or more: the order rotates
 * by one, so the throw moves round the table. Solo games are unchanged.
 */
export function nextThrowOrder(players, winner = null) {
  const list = [...(players || [])];
  if (list.length < 2) return list;
  if (list.length === 2) {
    if (winner && list.includes(winner)) return [list.find((u) => u !== winner), winner];
    return [list[1], list[0]];
  }
  return [...list.slice(1), list[0]];
}

/**
 * Same players, same rules, fresh game, with the throw order moved on
 * (nextThrowOrder) so the same player doesn't open every game. Pass
 * `{ keepOrder: true }` to replay the order unchanged. Killer re-draws its
 * numbers so a rematch isn't a replay of the same targets.
 */
export function rematchGame(game, { winner = null, keepOrder = false } = {}) {
  const players = keepOrder ? [...(game.players || [])] : nextThrowOrder(game.players, winner);
  const config = { ...(game.config || {}) };
  if (game.gameType === "killer") config.numbers = assignKillerNumbers(players);
  return { ...game, players, id: newGameId(), config, startedAt: new Date().toISOString() };
}
