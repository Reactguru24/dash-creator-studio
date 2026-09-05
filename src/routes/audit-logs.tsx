import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit logs · EuroVirtuals Backoffice" },
      { name: "description", content: "Full audit trail of privileged backoffice actions with pagination." },
      { property: "og:title", content: "Audit logs · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Full audit trail of privileged backoffice actions with pagination." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="audit-logs" />,
});
