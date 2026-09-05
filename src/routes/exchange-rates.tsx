import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/exchange-rates")({
  head: () => ({
    meta: [
      { title: "Exchange rates · EuroVirtuals Backoffice" },
      { name: "description", content: "Currency exchange rates used for backoffice reporting, ordered by exchange date." },
      { property: "og:title", content: "Exchange rates · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Currency exchange rates used for backoffice reporting, ordered by exchange date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="exchange-rates" />,
});
