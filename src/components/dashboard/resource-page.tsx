import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "./dashboard-shell";
import { ResourceView } from "./resource-view";
import { RESOURCES } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { stripEndpoint } from "@/lib/format";
import { useAuth, isClientAdmin } from "@/lib/use-auth";

export function ResourcePage({ resourceKey }: { resourceKey: string }) {
  const resource = RESOURCES[resourceKey];
  return (
    <DashboardShell title={resource.title} subtitle={stripEndpoint(resource.description)}>
      <ResourceView resource={resource} />
    </DashboardShell>
  );
}

export function TabbedResourcePage({
  title,
  subtitle,
  resourceKeys,
}: {
  title: string;
  subtitle: string;
  resourceKeys: string[];
}) {
  const { user } = useAuth();

  // Hide global (non-clientScoped) resource tabs for client-admin accounts.
  const visibleKeys = useMemo(() => {
    const clientAdmin = isClientAdmin(user);
    return resourceKeys.filter((k) => {
      const res = RESOURCES[k];
      if (!res) return false;
      if (!clientAdmin) return true;
      return Boolean(res.clientScoped);
    });
  }, [resourceKeys, user]);

  const [active, setActive] = useState<string | null>(visibleKeys[0] ?? null);
  const resource = active ? RESOURCES[active] : null;

  useEffect(() => {
    if (!active || !visibleKeys.includes(active)) {
      setActive(visibleKeys[0] ?? null);
    }
  }, [visibleKeys, active]);

  return (
    <DashboardShell title={title} subtitle={subtitle}>
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface/60 p-1.5">
        {visibleKeys.map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              key === active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {RESOURCES[key].title}
          </button>
        ))}
      </div>
      {resource ? (
        <>
          <p className="num mb-4 text-xs text-muted-foreground">{stripEndpoint(resource.description)}</p>
          <ResourceView resource={resource} />
        </>
      ) : (
        <p className="num mb-4 text-xs text-muted-foreground">No resources available</p>
      )}
    </DashboardShell>
  );
}
