import type { MetadataRoute } from "next";

import { siteUrl } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Owner-only / non-content routes.
      disallow: ["/api/", "/account", "/queue", "/sign-in", "/journal/new", "/journal/*/edit", "/strains/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
