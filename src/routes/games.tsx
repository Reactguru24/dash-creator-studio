import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Games · EuroVirtuals Backoffice" },
      { name: "description", content: "Browse the global game catalogue with partner, UUID and name filters." },
      { property: "og:title", content: "Games · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Browse the global game catalogue with partner, UUID and name filters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="games" />,
});
