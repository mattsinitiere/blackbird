export const X01_TARGETS = ["20", "19", "18", "17", "16", "15", "B"];

export const CRICKET_VALUE = {
  20: 20,
  19: 19,
  18: 18,
  17: 17,
  16: 16,
  15: 15,
  B: 25,
};

export const QUICK_SCORES = [26, 41, 45, 60, 81, 85, 100, 140];

export const BASEBALL_INNINGS = 9;

export const CRICKET_VARIANTS = [
  { id: "standard", label: "Score" },
  { id: "cutthroat", label: "Cutthroat" },
  { id: "noscore", label: "No-score" },
];

// Accent color choices for the theme picker (account page).
export const ACCENTS = {
  green: "#0e8c5a",
  blue: "#2563eb",
  violet: "#7c3aed",
  orange: "#ea580c",
  teal: "#0d9488",
  rose: "#e11d48",
};

// Text-size choices for the accessibility picker (account page).
// `value` is the multiplier applied to content text; shell text (nav, tags,
// table headers) scales on a gentler curve so the layout still fits at 2x.
export const FONT_SCALES = [
  { id: "normal", label: "Normal", value: 1 },
  { id: "large", label: "Large", value: 1.3 },
  { id: "larger", label: "Larger", value: 1.6 },
  { id: "huge", label: "Huge", value: 2 },
];

// Account that gets the admin panel (server-enforced; this is only for showing the UI).
export const ADMIN_EMAIL = "matthews@finishessolutions.com";

// Elo baseline for new/reset players.
export const BASE_ELO = 1000;
export const ELO_K = 24;
