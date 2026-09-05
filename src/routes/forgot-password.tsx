import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { ApiErrorBox } from "@/components/dashboard/api-error";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password · EuroVirtuals Backoffice" },
      {
        name: "description",
        content: "Request a password reset link for your EuroVirtuals backoffice staff account.",
      },
      { property: "og:title", content: "Reset your password · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "Request a password reset link for your EuroVirtuals backoffice staff account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
        auth: false,
      });
      setSent("If the email exists, a reset link has been sent.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Forgot password"
      subtitle="We'll email you a link to choose a new password."
      onSubmit={() => void submit()}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="label-eyebrow">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
          className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-2 focus:ring-ring"
        />
      </div>

      <ApiErrorBox error={error} />

      {sent ? (
        <p className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
          <MailCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {sent}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2} /> : null}
        Send reset link
      </button>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link to="/login" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          Back to sign in
        </Link>
        <Link to="/reset-password" className="hover:text-foreground">
          I already have a token
        </Link>
      </div>
    </AuthCard>
  );
}
