/**
 * Light markdown for Blackbird AI replies: models often answer with
 * **bold**, *italic*, "- " bullets, "1. " lists and "#" headings. This turns
 * that into a small block tree the chat renders as real formatting (never
 * raw HTML). Pure.
 *
 * Blocks: { type: "p" | "h", spans } | { type: "ul" | "ol", items: [spans] }
 * Spans:  { text, bold?, italic? }
 */

export function parseInline(text) {
  const spans = [];
  const re = /(\*\*|__)(.+?)\1|\*(?!\s)([^*]+?)\*|`([^`]+)`/g;
  let last = 0;
  let m;
  const src = String(text || "");
  while ((m = re.exec(src))) {
    if (m.index > last) spans.push({ text: src.slice(last, m.index) });
    if (m[2] != null) spans.push({ text: m[2], bold: true });
    else if (m[3] != null) spans.push({ text: m[3], italic: true });
    else spans.push({ text: m[4] });
    last = re.lastIndex;
  }
  if (last < src.length) spans.push({ text: src.slice(last) });
  return spans.length ? spans : [{ text: "" }];
}

export function parseAIText(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", spans: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "h", spans: parseInline(h[1].replace(/\*\*/g, "")) });
    } else if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(parseInline((ul || ol)[1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

// ---- identity: Blackbird AI never presents as another product ----------

const IDENTITY_Q = [
  /\bwhat(?:'s| is)? (?:model|llm|ai|engine|version)\b/i,
  /\bwhich (?:model|llm|ai|engine|company|version)\b/i,
  /\bwhat (?:model|llm|ai) (?:are|is|do) (?:you|this|it)\b/i,
  /\b(?:are|is) (?:you|this|it) (?:chat ?gpt|gpt|openai|gemini|claude|llama|grok|copilot|bard)\b/i,
  /\bwho (?:made|built|created|trained|developed|programmed) (?:you|this|it)\b/i,
  /^\W*(?:so\s+|and\s+)?what are you\W*$/i,
  /\bwhat (?:powers|runs) you\b/i,
  /\bwhat are you (?:built|based|running|trained) on\b/i,
  /\b(?:your|the) (?:system prompt|instructions|prompt|model name)\b/i,
  /^\W*(?:hi\W+|hey\W+)?who are you\W*$/i,
];

/** A question about what the assistant is, rather than about darts. */
export function isIdentityQuestion(q) {
  const s = String(q || "").trim();
  if (!s || s.length > 160) return false;
  return IDENTITY_Q.some((re) => re.test(s));
}

export const IDENTITY_REPLY =
  "I'm **Blackbird AI**, the darts coach built into Blackbird. I read your logged games, so ask me about your form, checkouts, rivals, achievements or what to practice next.";

const MODEL_NAMES = /\b(?:chat ?gpt|gpt-?\d[\w.-]*|gpt|google gemini|gemini|claude|llama|meta ai|mistral|grok)\b/gi;
const COMPANY_NAMES = /\b(?:openai|open ai|anthropic|google deepmind|deepmind|groq)\b/gi;

/**
 * Backstop for replies: any provider or model name becomes "Blackbird AI".
 * Fenced blocks (charts, follow-ups, actions) are left untouched.
 */
export function scrubIdentity(text) {
  return String(text || "")
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith("```") ? part : part.replace(MODEL_NAMES, "Blackbird AI").replace(COMPANY_NAMES, "Blackbird").replace(/Blackbird AI(?:[ ,/]+(?:by|from|and)?\s*Blackbird AI)+/gi, "Blackbird AI")))
    .join("");
}
