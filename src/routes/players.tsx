import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Players · EuroVirtuals Backoffice" },
      { name: "description", content: "Search player profiles across operators with registration date filters." },
      { property: "og:title", content: "Players · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Search player profiles across operators with registration date filters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="players" />,
});
