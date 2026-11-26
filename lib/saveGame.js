/**
 * The contract between the app and the server's save function,
 * record_game(p_game jsonb) in supabase/migration-record-game.sql. Kept in
 * one pure function so a test can pin it to the keys the SQL reads: if the
 * function and the app drift apart, the test fails before anything ships.
 */
export const RECORD_GAME_KEYS = ["game_id", "game_type", "config", "players", "winner", "completed_at", "stats"];

/** `rows` are the game_results rows buildResultRows makes; stats travel per player. */
export function recordGamePayload({ gameId, gameType, config, players, winner, completedAt, rows }) {
  return {
    game_id: gameId,
    game_type: gameType,
    config: config || {},
    players,
    winner,
    completed_at: completedAt,
    stats: Object.fromEntries((rows || []).map((r) => [r.username, r.stats])),
  };
}
