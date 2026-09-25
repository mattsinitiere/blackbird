import { parseAIText } from "@/lib/aiText";

function Spans({ spans }) {
  return spans.map((s, i) => {
    let el = s.text;
    if (s.italic) el = <em key={`i${i}`}>{el}</em>;
    if (s.bold) el = <strong key={`b${i}`}>{el}</strong>;
    return <span key={i}>{el}</span>;
  });
}

/** A Blackbird AI reply with its **bold**, lists and headings formatted. */
export default function AIText({ text }) {
  const blocks = parseAIText(text);
  return (
    <div className="ai-text ai-md">
      {blocks.map((b, i) => {
        if (b.type === "h") return <p key={i} className="ai-md-h"><Spans spans={b.spans} /></p>;
        if (b.type === "ul" || b.type === "ol") {
          const Tag = b.type;
          return (
            <Tag key={i}>
              {b.items.map((it, j) => (
                <li key={j}>
                  <Spans spans={it} />
                </li>
              ))}
            </Tag>
          );
        }
        return <p key={i}><Spans spans={b.spans} /></p>;
      })}
    </div>
  );
}
