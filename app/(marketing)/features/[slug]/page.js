import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/marketing/PageHero";
import FeatureRow from "@/components/marketing/FeatureRow";
import CTABand from "@/components/marketing/CTABand";
import { Mock } from "@/components/marketing/Mocks";
import { FEATURE_PAGES, featurePage } from "@/lib/marketing/features";

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_PAGES.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }) {
  const page = featurePage(params.slug);
  if (!page) return {};
  return {
    title: `${page.nav} Features`,
    description: page.description,
    alternates: { canonical: `/features/${page.slug}` },
  };
}

export default function FeatureDetailPage({ params }) {
  const page = featurePage(params.slug);
  if (!page) notFound();
  const others = FEATURE_PAGES.filter((p) => p.slug !== page.slug);
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PageHero eyebrow={page.eyebrow} title={page.title} intro={page.intro} actions={[{ href: "/app", text: "Open Blackbird" }, { href: "/features", text: "All Features" }]} />
      {page.rows.map((row, i) => (
        <FeatureRow key={row.title} index={i} {...row}>
          <Mock name={row.visual} />
        </FeatureRow>
      ))}
      <section className="mk-section mk-link-strip" aria-label="More features">
        {others.map((p) => (
          <Link key={p.slug} href={`/features/${p.slug}`}>
            <span className="mk-label mk-blue">{p.nav.toUpperCase()}</span>
            <strong>{p.card}</strong>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </section>
      <CTABand label={page.cta.label} title={page.cta.title} />
    </main>
  );
}
