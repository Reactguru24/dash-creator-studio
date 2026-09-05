import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/dashboard/resource-page";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Wallet transactions · EuroVirtuals Backoffice" },
      { name: "description", content: "Browse the wallet debit and credit ledger by operator, player and reference." },
      { property: "og:title", content: "Wallet transactions · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Browse the wallet debit and credit ledger by operator, player and reference." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ResourcePage resourceKey="transactions" />,
});
