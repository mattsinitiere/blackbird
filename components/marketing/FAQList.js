import Link from "next/link";

/** FAQ items as native disclosures; the first one starts open. */
export default function FAQList({ items }) {
  return (
    <div className="mk-faq-items">
      {items.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
          {item.link && <Link href={item.link.href}>{item.link.text}</Link>}
        </details>
      ))}
    </div>
  );
}
