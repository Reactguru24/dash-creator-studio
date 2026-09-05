import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/bet-attempts")({
  head: () => ({
    meta: [
      { title: "Bet attempts · EuroVirtuals Backoffice" },
      { name: "description", content: "Inspect engine-level bet attempt logs from crash and partner game providers." },
      { property: "og:title", content: "Bet attempts · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Inspect engine-level bet attempt logs from crash and partner game providers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="bet-attempts" />,
});
