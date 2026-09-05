import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

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
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/login", changefreq: "monthly", priority: "0.5" },
          { path: "/bets", changefreq: "daily", priority: "0.8" },
          { path: "/bet-attempts", changefreq: "daily", priority: "0.6" },
          { path: "/players", changefreq: "daily", priority: "0.8" },
          { path: "/transactions", changefreq: "daily", priority: "0.8" },
          { path: "/freebets", changefreq: "daily", priority: "0.6" },
          { path: "/exchange-rates", changefreq: "weekly", priority: "0.5" },
          { path: "/games", changefreq: "weekly", priority: "0.7" },
          { path: "/operator-games", changefreq: "weekly", priority: "0.7" },
          { path: "/clients", changefreq: "weekly", priority: "0.7" },
          { path: "/partners", changefreq: "weekly", priority: "0.6" },
          { path: "/promotions", changefreq: "weekly", priority: "0.7" },
          { path: "/users", changefreq: "weekly", priority: "0.5" },
          { path: "/access", changefreq: "monthly", priority: "0.4" },
          { path: "/risk", changefreq: "weekly", priority: "0.5" },
          { path: "/audit-logs", changefreq: "daily", priority: "0.6" },
          { path: "/invoices", changefreq: "monthly", priority: "0.5" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
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
