/**
 * Layout decisions for the /tv scoreboard. Pure: the TV page and its tests
 * share these so "does it fit on a 16:9 screen" is checked in one place.
 *
 * Sizes are in viewport units so the same answer works on a 1600x900
 * browser window and a 1920x1080 TV. The live view never scrolls (nobody
 * can scroll a TV), so every number here is chosen to fit the screen below
 * the header and above the code footer.
 */

// game types whose TV layout has a dartboard next to the scores; only
// these get the "hide board" toggle
export const TV_BOARD_GAMES = ["x01", "cricket", "baseball", "killer", "shanghai"];

export function tvHasBoard(gameType) {
  return TV_BOARD_GAMES.includes(gameType);
}

// share of the screen the player cards may use: the dartboard column takes
// about a third of the width, and the header plus footer about a quarter of
// the height
const WIDTH_WITH_BOARD = 60; // vw
const WIDTH_NO_BOARD = 92; // vw
const HEIGHT = 70; // vh
const GAP = 1.6; // vw between cards

/**
 * Grid for `count` player cards. With the board shown, four players go 2x2
 * (four in a row next to a board would be too narrow to read); without it
 * everyone sits in one row. Returns { cols, rows }.
 */
export function tvCardGrid(count, { board = true } = {}) {
  const n = Math.max(1, count || 1);
  const cols = board && n === 4 ? 2 : Math.min(n, 4);
  return { cols, rows: Math.ceil(n / cols) };
}

/**
 * The card font size for `count` players: the card's text is laid out in
 * em, so this one number scales the score, name and visit strip together.
 * `chars` is how wide the big value is (3 for an X01 score, more for a
 * row of lives). Returns { cols, rows, vw, vh }: CSS uses min(vw, vh).
 */
export function tvCardSize(count, { board = true, chars = 3 } = {}) {
  const { cols, rows } = tvCardGrid(count, { board });
  const width = board ? WIDTH_WITH_BOARD : WIDTH_NO_BOARD;
  const colWidth = (width - GAP * (cols - 1)) / cols;
  // a bold digit is about 0.62em wide; leave room for the card padding
  const byWidth = (colWidth * 0.8) / (Math.max(1, chars) * 0.62);
  // a card is about 2.1em tall (name, value, stats line, visit strip)
  const byHeight = (HEIGHT - 2 * (rows - 1)) / rows / 2.1;
  const round = (v) => Math.round(v * 10) / 10;
  return { cols, rows, vw: round(Math.min(byWidth, 13)), vh: round(Math.min(byHeight, 24)) };
}

/** Pixel size of the card font on a given screen (for tests and checks). */
export function tvCardPx(size, width, height) {
  return Math.min((size.vw * width) / 100, (size.vh * height) / 100);
}

/**
 * Who is at the oche in Killer: the fixed throw order, skipping players
 * who are out (same rule as the phone).
 */
export function killerCurrent(players, lives, turn) {
  for (let k = 0; k < players.length; k++) {
    const u = players[(turn + k) % players.length];
    if ((lives?.[u] ?? 1) > 0) return u;
  }
  return players[0];
}

/**
 * What the current Killer thrower is aiming at: their own double until they
 * are a killer, then the doubles of everyone still alive.
 */
export function killerTargets(players, numbers, lives, killer, cur) {
  if (!killer?.[cur]) return numbers?.[cur] != null ? [numbers[cur]] : [];
  return players.filter((u) => u !== cur && (lives?.[u] ?? 0) > 0).map((u) => numbers?.[u]).filter((n) => n != null);
}

/**
 * The last finished X01 visit of a player in the current leg, from the
 * stats recorder the snapshot already carries: { score, bust } or null.
 */
export function lastX01Visit(rec, u, leg = 0) {
  const visits = rec?.visits?.[u];
  if (!visits || !visits.length) return null;
  const v = visits[visits.length - 1];
  if ((v.r ?? 0) !== leg) return null;
  const bust = v.out?.k === "bust";
  const score = bust ? 0 : v.out?.s ?? 0;
  return { score, bust };
}
