import { siteUrl } from "@/lib/siteUrl";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/login", "/signup", "/reset", "/api/", "/tv", "/privacy", "/terms", "/profile"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
