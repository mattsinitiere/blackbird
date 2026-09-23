/**
 * Absolute origin of the deployed site, for canonical links, the sitemap
 * and emailed auth links. SITE_URL wins; on Vercel the production host is
 * used; locally it is the dev server.
 */
export function siteUrl() {
  const raw =
    process.env.SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
