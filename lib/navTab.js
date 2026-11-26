// Which bottom-nav tab is lit for a screen.
//
// Most screens belong to one tab (the leaderboard is Stats, settings are Me).
// A few are reached from anywhere: a match report, another player's profile,
// the friends list. Those keep the tab the user was on when they opened them,
// so a report opened from your profile leaves Me lit and a profile opened from
// Search on Home leaves Home lit.

export const NAV_TABS = ["home", "play", "stats", "matchup", "ai", "me"];

// screens that always light the same tab
const FIXED = {
  home: "home",
  setup: "play",
  bots: "play",
  summary: "play",
  practice: "play",
  leaderboard: "stats",
  records: "stats",
  matchup: "matchup",
  ai: "ai",
  account: "me",
  admin: "me",
};

/**
 * The tab to light for `view`. `prev` is the tab lit on the previous screen
 * (what a borrowed screen keeps); `onMyProfile` is true when the profile shown
 * is your own (always the Me tab). Game screens ("play…") are Play.
 */
export function navTabFor(view, { prev = "home", onMyProfile = false } = {}) {
  if (FIXED[view]) return FIXED[view];
  if (typeof view === "string" && /^play[A-Z]/.test(view)) return "play";
  if (view === "profile" && onMyProfile) return "me";
  // borrowed screens (match report, someone else's profile, friends)
  return NAV_TABS.includes(prev) ? prev : "home";
}
