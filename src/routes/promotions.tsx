import { createFileRoute } from "@tanstack/react-router";
import { TabbedResourcePage } from "@/components/dashboard/resource-page";
import { isClientAdmin, useAuth } from "@/lib/use-auth";

function PromotionsPage() {
  const { user } = useAuth();
  const resourceKeys = [
    "freebet-capabilities",
    "bonus-config",
    "freebet-config",
    "operator-game-freebets",
    "freebet-campaigns",
    "freebet-awards",
  ].filter((key) => !(isClientAdmin(user) && key === "freebet-capabilities"));

  return (
    <TabbedResourcePage
      title="Promotions"
      subtitle="Bonus and freebet configuration, campaigns and awards"
      resourceKeys={resourceKeys}
    />
  );
}

export const Route = createFileRoute("/promotions")({
  head: () => ({
    meta: [
      { title: "Promotions · EuroVirtuals Backoffice" },
      { name: "description", content: "Bonus configs, freebet configs, capabilities, campaigns and awards for EuroVirtuals operators." },
      { property: "og:title", content: "Promotions · EuroVirtuals Backoffice" },
      { property: "og:description", content: "Bonus configs, freebet configs, capabilities, campaigns and awards for EuroVirtuals operators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PromotionsPage,
});
