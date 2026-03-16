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
        "/saved-searches",
        "/notifications",
        "/notification-settings",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
