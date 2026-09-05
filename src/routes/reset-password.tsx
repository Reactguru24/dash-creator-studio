import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { ApiErrorBox } from "@/components/dashboard/api-error";
import { AuthCard } from "@/components/auth-card";

type ResetSearch = { token?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Choose a new password · EuroVirtuals Backoffice" },
      {
        name: "description",
        content: "Set a new password for your EuroVirtuals backoffice account using your emailed reset token.",
      },
      { property: "og:title", content: "Choose a new password · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "Set a new password for your EuroVirtuals backoffice account using your emailed reset token.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [token, setToken] = useState(search.token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (search.token) setToken(search.token);
  }, [search.token]);

  const submit = async () => {
    if (password !== confirm) {
      setError(new Error("The two passwords do not match."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, password },
        auth: false,
      });
      toast.success("Password updated — sign in with your new password.");
      void navigate({ to: "/login" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Paste the token from your reset email, then pick a new password."
      onSubmit={() => void submit()}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="token" className="label-eyebrow">
          Reset token
        </label>
        <input
          id="token"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="num h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="label-eyebrow">
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="label-eyebrow">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
        />
      </div>

      <ApiErrorBox error={error} />

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : null}
        Update password
      </button>

      <Link to="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} />
        Back to sign in
      </Link>
    </AuthCard>
  );
}
