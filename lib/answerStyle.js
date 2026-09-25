/**
 * Answer Style: how long and how detailed Blackbird AI's replies are.
 * Presentation only. Every style uses the same model, the same fixed
 * reasoning effort, the same token ceilings and the same tool budget
 * (lib/aiProviders.js BUDGETS, lib/aiAgent.js MAX_STEPS); the only
 * difference is one line in the prompt asking for a shorter or fuller
 * answer, so actual length can still vary within those limits.
 */

export const ANSWER_STYLES = [
  { id: "brief", label: "Brief", hint: "Short, to the point" },
  { id: "balanced", label: "Balanced", hint: "The everyday default" },
  { id: "detailed", label: "Detailed", hint: "More detail and examples" },
];

export const DEFAULT_STYLE = "balanced";

const PROMPT_LINES = {
  brief: "ANSWER STYLE: brief. Answer in at most about 80 words: the key numbers and one takeaway. Skip the list unless asked.",
  balanced: "",
  detailed: "ANSWER STYLE: detailed. Give a fuller answer (up to about 350 words) with the supporting numbers, sample sizes and one or two concrete examples.",
};

/** A known style id, or the default. Anything else a client sends is ignored. */
export function normalizeStyle(v) {
  return ANSWER_STYLES.some((s) => s.id === v) ? v : DEFAULT_STYLE;
}

/** The prompt line for a style ("" for balanced). */
export function styleLine(v) {
  return PROMPT_LINES[normalizeStyle(v)];
}
