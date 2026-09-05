import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners · EuroVirtuals Backoffice" },
      { name: "description", content: "Game providers integrated into the EuroVirtuals platform." },
      { property: "og:title", content: "Partners · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Game providers integrated into the EuroVirtuals platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="partners" />,
});
