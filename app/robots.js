import { siteUrl } from "@/lib/siteUrl";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/login", "/signup", "/reset", "/api/", "/tv", "/privacy", "/terms"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
