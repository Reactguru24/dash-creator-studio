import { stripEndpoint } from "@/lib/format";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InvoiceView } from "@/components/dashboard/invoice-view";
import { RESOURCES } from "@/lib/endpoints";

export const Route = createFileRoute("/invoices")({
  head: () => ({
    meta: [
      { title: "Client invoices · EuroVirtuals Backoffice" },
      { name: "description", content: "Generate monthly client invoice data from game summary aggregates." },
      { property: "og:title", content: "Client invoices · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Generate monthly client invoice data from game summary aggregates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const resource = RESOURCES["invoices"];
  return (
    <DashboardShell title={resource.title} subtitle={stripEndpoint(resource.description)}>
      <InvoiceView resource={resource} />
    </DashboardShell>
  );
}
