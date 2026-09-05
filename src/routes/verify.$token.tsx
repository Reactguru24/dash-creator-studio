import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { ApiErrorBox } from "@/components/dashboard/api-error";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/verify/$token")({
  head: () => ({
    meta: [
      { title: "Verify email · EuroVirtuals Backoffice" },
      {
        name: "description",
        content: "Verify your email address for EuroVirtuals backoffice accounts.",
      },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const navigate = useNavigate();
  const { token } = Route.useParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

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
      title="Verify your email"
      subtitle="Set a new password to finish verifying your account."
      onSubmit={() => void submit()}
    >
      <input type="hidden" value={token} />

      <div className="mt-4 grid gap-2">
        <label className="label-eyebrow">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="label-eyebrow">Confirm password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
