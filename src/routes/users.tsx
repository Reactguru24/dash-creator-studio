import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "Backoffice users · EuroVirtuals Backoffice" },
      { name: "description", content: "Staff accounts, roles and direct permissions for the backoffice." },
      { property: "og:title", content: "Backoffice users · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Staff accounts, roles and direct permissions for the backoffice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="users" />,
});
