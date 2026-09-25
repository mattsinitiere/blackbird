import { siteUrl } from "@/lib/siteUrl";
import { FEATURE_PAGES } from "@/lib/marketing/features";

const PAGES = [
  { path: "/", priority: 1 },
  { path: "/features", priority: 0.9 },
  ...FEATURE_PAGES.map((p) => ({ path: `/features/${p.slug}`, priority: 0.8 })),
  { path: "/games", priority: 0.7 },
  { path: "/tv-mode", priority: 0.7 },
  { path: "/faq", priority: 0.6 },
];

export default function sitemap() {
  const lastModified = new Date();
  return PAGES.map((p) => ({ url: `${siteUrl()}${p.path}`, lastModified, changeFrequency: "monthly", priority: p.priority }));
}
