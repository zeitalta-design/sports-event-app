import { siteConfig } from "@/lib/site-config";

export default function robots() {
  const baseUrl = siteConfig.siteUrl;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/login",
        "/signup",
        "/favorites",
        "/saved",
        "/saved-searches",
        "/notifications",
        "/notification-settings",
        "/profile",
        "/my-events",
        "/my-results",
        "/reviews/new",
        "/compare",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
