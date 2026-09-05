import { createFileRoute } from "@tanstack/react-router";
import { TabbedResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Roles & permissions · EuroVirtuals Backoffice" },
      { name: "description", content: "Backoffice role definitions and the granular permission catalogue." },
      { property: "og:title", content: "Roles & permissions · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Backoffice role definitions and the granular permission catalogue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <TabbedResourcePage
      title="Roles & permissions"
      subtitle="Role definitions and permission catalogue"
      resourceKeys={["roles", "permissions"]}
    />
  ),
});
