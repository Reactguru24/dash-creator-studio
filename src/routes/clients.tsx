import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Clients · EuroVirtuals Backoffice" },
      { name: "description", content: "Onboarded operators, their settings and API configuration." },
      { property: "og:title", content: "Clients · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Onboarded operators, their settings and API configuration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="clients" />,
});
