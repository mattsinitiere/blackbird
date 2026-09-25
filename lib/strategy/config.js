/**
 * Tunables for the strategy engine (lib/strategy/*). Everything the engine
 * ranks by lives here so the choices are visible, documented and testable.
 * Advice is advisory only: nothing here changes how a game is scored.
 */

/**
 * The standard finishing-double preference, best first. D20 and D16 are the
 * classic "top" doubles; D16 splits cleanly (16 → 8 → 4 → 2) after a single
 * miss, which is why the halving doubles rank high. Odd doubles that do not
 * split follow. The bull (50) is ranked after every double: it is the
 * smallest scoring target a finish can end on.
 */
export const STANDARD_DOUBLES = [
  "D20", "D16", "D8", "D10", "D18", "D12", "D4", "D6", "D14", "D2",
  "D9", "D5", "D7", "D3", "D11", "D13", "D15", "D17", "D19", "D1",
];

/** Label of the double bull (n 25, mult 2), as lib/checkouts.js prints it. */
export const BULL = "Bull";

/** STANDARD_DOUBLES with the bull appended last: the full finishing order. */
export const DOUBLE_ORDER = [...STANDARD_DOUBLES, BULL];

/**
 * Next-visit leaves a setup visit aims for, best first (one-dart doubles).
 * 32 first because D16 keeps halving after a single; then 40 (D20), 36
 * (D18), and the other halving doubles. Anything not listed ranks after,
 * in DOUBLE_ORDER order, with 50 (bull) last.
 */
export const LEAVE_PREFERENCE = [32, 40, 36, 16, 24, 20, 8, 12, 4, 28, 2];

/**
 * Setup-dart number preference, best first: the numbers a player aims at
 * when the exact number does not matter (20 at the top of the board, then
 * its neighbourhood and the usual switch numbers).
 */
export const SETUP_NUMBERS = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

/**
 * Cost of a setup (non-finishing) dart by bed, added to its SETUP_NUMBERS
 * index. Singles are the widest bed; trebles are the normal scoring aim;
 * a double or bull as a setup dart is a small target for no reason.
 */
export const SETUP_BED_COST = { single: 0, treble: 10, double: 30, outerBull: 30, bull: 40 };

/**
 * Score added to a not-finishable leave that sits inside the finishing
 * range (a "bogey" such as 169 or 159) when a setup visit ranks its
 * options. 10 means "rather leave up to ~10 more than a bogey".
 */
export const BOGEY_PENALTY = 10;

/**
 * Checkout routes only: a route on the player's preferred double is taken
 * when it needs the same number of darts as the standard best and its
 * setup cost is at most this much higher (one treble-for-single swap).
 */
export const PREFERENCE_SETUP_MARGIN = 10;

/**
 * Personal data overrides the standard double only when BOTH doubles have
 * at least this many darts with a known intended target.
 */
export const MIN_TARGET_ATTEMPTS = 30;

/**
 * z for the Wilson score interval. 1.645 is the two-sided 90% interval;
 * the engine requires the candidate's lower bound to beat the standard
 * double's upper bound, a deliberately conservative test.
 */
export const CONFIDENCE_Z = 1.645;

/** Darts in a visit. */
export const DARTS_PER_VISIT = 3;
