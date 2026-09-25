/**
 * Bot opponents. A bot is a player id with a reserved prefix, so it flows
 * through game.players, perPlayer, turn order and the TV cast untouched;
 * only name rendering and persistence treat it specially (bots never get
 * a game_results row and never touch Elo).
 *
 * Accuracy is one number per bot: `sigma`, the standard deviation in mm
 * of where a dart lands around its aim point (lib/simulator.js). Each
 * sigma was fitted by simulation so that throwing at T20 produces the
 * bot's nominal 3-dart `avg` (tests/simulator.test.mjs keeps it honest).
 * `checkout` is how often the bot knows the right setup shot when a
 * finish is on (lib/botStrategy.js). Pure: no React, no network.
 */

export const BOT_PREFIX = "bot:";

export const BOTS = [
  { id: "bot:rook", name: "Rook", level: 1, avg: 32, sigma: 55.4, checkout: 0.15, color: "#8b8f97", blurb: "Just learning where the 20 is." },
  { id: "bot:sparrow", name: "Sparrow", level: 2, avg: 40, sigma: 31.4, checkout: 0.3, color: "#b07d4f", blurb: "Pub regular. Hits the board, mostly." },
  { id: "bot:jay", name: "Jay", level: 3, avg: 48, sigma: 22.2, checkout: 0.45, color: "#3b82f6", blurb: "Finds the 20 bed more often than not." },
  { id: "bot:magpie", name: "Magpie", level: 4, avg: 56, sigma: 18, checkout: 0.6, color: "#1f2937", blurb: "Steals the odd leg with a big finish." },
  { id: "bot:raven", name: "Raven", level: 5, avg: 65, sigma: 15, checkout: 0.7, color: "#4c1d95", blurb: "League night material." },
  { id: "bot:falcon", name: "Falcon", level: 6, avg: 75, sigma: 12.5, checkout: 0.8, color: "#b45309", blurb: "Quick around the board, sharp on doubles." },
  { id: "bot:kestrel", name: "Kestrel", level: 7, avg: 88, sigma: 10.1, checkout: 0.9, color: "#be123c", blurb: "Trebles for fun. Bring your A game." },
  { id: "bot:blackbird", name: "Blackbird", level: 8, avg: 100, sigma: 8.3, checkout: 1, color: "#111827", blurb: "The one to beat." },
];

const BY_ID = new Map(BOTS.map((b) => [b.id, b]));

export function isBot(u) {
  return typeof u === "string" && u.startsWith(BOT_PREFIX);
}

export function botFor(u) {
  return BY_ID.get(u) || null;
}

/** Display name for a player id: bots get their name, humans pass through. */
export function playerLabel(u) {
  if (!isBot(u)) return u;
  const b = BY_ID.get(u);
  if (b) return b.name;
  if (u === "bot:alterego") return "Alter Ego"; // lib/alterEgo.js (built per game, not on the ladder)
  const slug = u.slice(BOT_PREFIX.length);
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** { botId: color } for merging into the app's playerColors map. */
export function botColors() {
  return { ...Object.fromEntries(BOTS.map((b) => [b.id, b.color])), "bot:alterego": "#0f766e" };
}

/** Game types a bot can play. */
export const BOT_GAMES = new Set(["x01", "cricket", "baseball"]);
