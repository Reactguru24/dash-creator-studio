import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useAuth, userLabel, userRole, clientScope } from "@/lib/use-auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ApiErrorBox } from "@/components/dashboard/api-error";
import { ReadableValue } from "@/components/dashboard/readable-value";
import { formatCellValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import {
  CredentialsBanner,
  extractCredentials,
  type IssuedCredentials,
} from "@/components/dashboard/credentials-banner";
import { ACTIONS } from "@/lib/actions";

const REGENERATE_KEY_ACTION = ACTIONS.clients?.find(
  (action) => action.key === "client-regenerate-key-self",
);

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · EuroVirtuals Backoffice" },
      {
        name: "description",
        content: "Update your password and review your authenticated profile for the EuroVirtuals backoffice.",
      },
      { property: "og:title", content: "Settings · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "Update your password and review your authenticated profile for the EuroVirtuals backoffice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);

  const profileLabel = userLabel(user);
  const profileRole = userRole(user);
  const profileFields = ["id", "email", "first_name", "last_name", "user_type", "role_id"];
  const profileDetails = user
    ? Object.entries(user).filter(([key]) => profileFields.includes(key))
    : [];
  const permissionValue = user?.permissions;
  const scope = clientScope(user);
  const clientNames = Array.isArray(user?.clients)
    ? (user.clients as Array<Record<string, unknown>>)
        .map((c) => (c && typeof c === "object" ? String(c.name ?? c.id ?? "") : String(c)))
        .filter(Boolean)
    : [];

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(new Error("All fields are required."));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(new Error("The new passwords do not match."));
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/api/v1/auth/change-password", {
        method: "POST",
        body: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title="Settings" subtitle="Authenticated profile and password management">
      <div className="space-y-6">
        <section className="panel space-y-4 p-6">
          <div>
            <p className="label-eyebrow">Authenticated user</p>
            <h2 className="font-display text-xl font-semibold">{userLabel(user)}</h2>
            <p className="text-sm text-muted-foreground">{userRole(user) ?? "Authenticated user"}</p>
          </div>

          <div className="rounded-3xl border border-border bg-muted/50 p-5">
            {user ? (
              <>
                <div className="flex flex-col gap-3 rounded-3xl bg-background/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="label-eyebrow">Signed in as</p>
                    <h2 className="text-lg font-semibold tracking-tight">{profileLabel}</h2>
                    <p className="text-sm text-muted-foreground">{profileRole ?? "Authenticated user"}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                    {profileRole ?? "USER"}
                  </div>
                </div>

                <dl className="mt-6 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {profileDetails.map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-surface p-3 shadow-sm">
                      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{key.replace(/[_\s]+/g, " ")}</dt>
                      <dd className="mt-2 text-sm font-medium text-foreground break-words">
                        {formatCellValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>

                {scope.clientAdmin ? (
                  <div className="mt-6 rounded-2xl bg-surface p-4 shadow-sm">
                    <p className="label-eyebrow">Client access</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {scope.mode === "single"
                        ? scope.operatorId
                          ? `Single-client admin — scoped to operator #${scope.operatorId}. Client-scoped endpoints resolve your operator from the session.`
                          : "Single-client admin — your client is resolved from the session, so no operator needs to be selected."
                        : `Multi-client admin — ${clientNames.length ? clientNames.join(", ") : `operators ${scope.ids.join(", ")}`}. Client-scoped endpoints require you to pick an operator.`}
                    </p>
                  </div>
                ) : null}

                {permissionValue ? (
                  <div className="mt-6 rounded-2xl bg-surface p-4 shadow-sm">
                    <p className="label-eyebrow">Permissions</p>
                    <div className="mt-3 max-h-48 overflow-auto text-sm text-muted-foreground">
                      {typeof permissionValue === "string" ? (
                        <p className="break-words">{permissionValue}</p>
                      ) : (
                        <ReadableValue value={permissionValue} />
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Your authenticated profile is currently unavailable.</p>
            )}
          </div>
        </section>

        {scope.clientAdmin && REGENERATE_KEY_ACTION ? (
          <section className="panel space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div>
              <p className="label-eyebrow">API credentials</p>
              <p className="text-sm text-muted-foreground">
                Issue a new API key for your client. The previous key stops working immediately and
                the new key is shown only once.
              </p>
            </div>

            {issued ? (
              <CredentialsBanner credentials={issued} onDismiss={() => setIssued(null)} />
            ) : null}

            <Button variant="destructive" onClick={() => setRegenOpen(true)}>
              Regenerate API key
            </Button>

            {regenOpen ? (
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
        ) : null}

        <section className="panel space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div>
            <p className="label-eyebrow">Change password</p>
            <p className="text-sm text-muted-foreground">
              Use your current password and choose a strong new password.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="current-password" className="label-eyebrow">
                Current password
              </label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="new-password" className="label-eyebrow">
                New password
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm-password" className="label-eyebrow">
                Confirm new password
              </label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <ApiErrorBox error={error} />

          {success ? (
            <div className="rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-success">
              {success}
            </div>
          ) : null}

          <Button type="button" onClick={handleSubmit} disabled={busy} className="w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
        </section>
      </div>
    </DashboardShell>
  );
}
