import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { PRODUCTS } from "@/lib/products";
import { SEO_LANDINGS } from "@/lib/seo-landings";

const BASE_URL = "https://fatuimarket.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/track", changefreq: "monthly", priority: "0.7" },
          { path: "/terms", changefreq: "monthly", priority: "0.5" },
          { path: "/refund", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "monthly", priority: "0.5" },
          { path: "/guides/genshin-impact-top-up", changefreq: "monthly", priority: "0.8" },
          { path: "/buy", changefreq: "weekly", priority: "0.8" },
          ...PRODUCTS.map((p) => ({
            path: `/products/${p.slug}`,
            changefreq: "weekly" as const,
            priority: "0.9",
          })),
          ...SEO_LANDINGS.map((l) => ({
            path: `/buy/${l.slug}`,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
        ];

        const today = new Date().toISOString().split("T")[0];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <lastmod>${e.lastmod ?? today}</lastmod>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});