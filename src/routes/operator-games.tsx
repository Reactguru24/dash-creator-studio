import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/operator-games")({
  head: () => ({
    meta: [
      { title: "Operator games · EuroVirtuals Backoffice" },
      { name: "description", content: "Review which games each operator has enabled and how they are configured." },
      { property: "og:title", content: "Operator games · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Review which games each operator has enabled and how they are configured." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="operator-games" />,
});
