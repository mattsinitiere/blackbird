import PageHero from "@/components/marketing/PageHero";
import CTABand from "@/components/marketing/CTABand";
import FAQList from "@/components/marketing/FAQList";
import { FAQS } from "@/lib/marketing/faq";

export const metadata = {
  title: "FAQs",
  description: "Answers about Blackbird: hardware, accounts and invites, practice, the TV scoreboard, Blackbird AI, Merlin, and playing offline.",
  alternates: { canonical: "/faq" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function FAQPage() {
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PageHero eyebrow="QUESTIONS" title={["Good to Know.", "Before You Throw."]} intro="Short answers to the things people ask most." />
      <section className="mk-section mk-faq">
        <div className="mk-faq-layout mk-faq-single">
          <FAQList items={FAQS} />
        </div>
      </section>
      <CTABand />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </main>
  );
}
