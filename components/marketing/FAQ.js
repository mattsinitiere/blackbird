import Link from "next/link";
import FAQList from "./FAQList";
import { FAQS } from "@/lib/marketing/faq";

export default function FAQ() {
  return (
    <section className="mk-section mk-faq" id="questions">
      <div className="mk-section-mark">
        <span>[ 05 / 05 ]</span>
      </div>
      <div className="mk-faq-layout">
        <div>
          <h2>Good to Know.</h2>
          <Link className="mk-text-link" href="/faq">
            All questions <span aria-hidden="true">→</span>
          </Link>
        </div>
        <FAQList items={FAQS.slice(0, 5)} />
      </div>
    </section>
  );
}
