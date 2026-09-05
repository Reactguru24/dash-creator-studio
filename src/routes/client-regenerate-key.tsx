import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useAuth, clientScope } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { CredentialsBanner, extractCredentials, type IssuedCredentials } from "@/components/dashboard/credentials-banner";
import { ACTIONS } from "@/lib/actions";

const REGENERATE_KEY_ACTION = ACTIONS.clients?.find((action) => action.key === "client-regenerate-key-self");

export const Route = createFileRoute("/client-regenerate-key")({
  head: () => ({
    meta: [
      { title: "Regenerate API key · Backoffice" },
      { name: "description", content: "Regenerate the API key for your client (CLIENT_ADMIN only)." },
      { property: "og:title", content: "Regenerate API key · Backoffice" },
    ],
  }),
  component: RegenerateApiKeyPage,
});

function RegenerateApiKeyPage() {
  const { user, ready } = useAuth();
  const scope = clientScope(user);
  const [regenOpen, setRegenOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);

  // Hide the page from non-client-admins.
  if (!ready) return <div aria-hidden />;

  if (!scope.clientAdmin) {
    return (
      <DashboardShell title="Regenerate API key">
        <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h2 className="mt-3 font-display text-base font-semibold">Not available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This page is restricted to client administrator accounts. Your account does not have access.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Regenerate API key">
      <div className="space-y-6">
        <section className="panel space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="label-eyebrow">API credentials</p>
            <p className="text-sm text-muted-foreground">
              Issue a new API key for your client. The previous key stops working immediately and the new key is shown only once.
            </p>
          </div>

          {issued ? (
            <CredentialsBanner credentials={issued} onDismiss={() => setIssued(null)} />
          ) : null}

          <Button variant="destructive" onClick={() => setRegenOpen(true)}>
            Regenerate API key
          </Button>

          {regenOpen && REGENERATE_KEY_ACTION ? (
            <ActionDialog
              action={REGENERATE_KEY_ACTION}
              open
              onOpenChange={setRegenOpen}
              onSuccess={(data) => {
                const creds = extractCredentials(data);
                if (creds) setIssued(creds);
              }}
            />
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}
