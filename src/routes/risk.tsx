import { createFileRoute } from "@tanstack/react-router";
import { TabbedResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Risk controls · EuroVirtuals Backoffice" },
      { name: "description", content: "Player blacklist and operator API IP whitelist management." },
      { property: "og:title", content: "Risk controls · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Player blacklist and operator API IP whitelist management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <TabbedResourcePage
      title="Risk controls"
      subtitle="Player blacklist and API IP whitelist"
      resourceKeys={["blacklist", "whitelist"]}
    />
  ),
});
