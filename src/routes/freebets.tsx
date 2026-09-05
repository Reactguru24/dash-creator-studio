import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/freebets")({
  head: () => ({
    meta: [
      { title: "Freebet ledger · EuroVirtuals Backoffice" },
      { name: "description", content: "Track issued freebet balances, usage and status per operator and game." },
      { property: "og:title", content: "Freebet ledger · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Track issued freebet balances, usage and status per operator and game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="freebets" />,
});
