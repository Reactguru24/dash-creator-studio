import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/bets")({
  head: () => ({
    meta: [
      { title: "Bets · EuroVirtuals Backoffice" },
      { name: "description", content: "Search bets per game with posting state, operator and date filters in the EuroVirtuals backoffice." },
      { property: "og:title", content: "Bets · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Search bets per game with posting state, operator and date filters in the EuroVirtuals backoffice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="bets" />,
});
