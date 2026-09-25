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
