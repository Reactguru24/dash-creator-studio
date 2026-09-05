import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest, findObject, findString, tokenStore } from "@/lib/api";
import { ApiErrorBox } from "@/components/dashboard/api-error";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Secure OTP sign-in for the EuroVirtuals backoffice: bets, players, wallet transactions, promotions and audit logs.",
      },
      { property: "og:title", content: "Sign in · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "Two-step OTP authentication for the EuroVirtuals backoffice control panel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (tokenStore.access) void navigate({ to: "/" });
  }, [navigate]);

  const handleError = (err: unknown) => {
    setError(err);
  };

  const submitCredentials = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      const token = findString(payload, ["challenge_token", "challengeToken", "token"]);
      const access = findString(payload, ["access_token", "accessToken"]);
      if (access) {
        finishLogin(access, payload);
        return;
      }
      if (!token) {
        setError(new Error("Login accepted but no OTP challenge token was returned."));
        return;
      }
      setChallenge(token);
      setStep("otp");
      setNotice("We emailed a 6-digit code to your address.");
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const finishLogin = (access: string, payload: unknown) => {
    const refresh = findString(payload, ["refresh_token", "refreshToken"]);
    const user = findObject(payload, ["user", "profile"]);
    // CLIENT_ADMIN logins return the assigned clients alongside the user object.
    const data = (payload as { data?: { clients?: unknown } } | null)?.data;
    const clients =
      (Array.isArray(data?.clients) ? data?.clients : undefined) ??
      (Array.isArray((payload as { clients?: unknown } | null)?.clients)
        ? (payload as { clients?: unknown[] }).clients
        : undefined);
    tokenStore.set(access, refresh, user ? { ...user, ...(clients ? { clients } : {}) } : user);
    void navigate({ to: "/" });
  };

  const submitOtp = async () => {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiRequest("/api/v1/auth/verify-otp", {
        method: "POST",
        body: { challenge_token: challenge, otp },
        auth: false,
      });
      const access = findString(payload, ["access_token", "accessToken", "token"]);
      if (!access) {
        setError(new Error("OTP verified but no access token was returned."));
        return;
      }
      finishLogin(access, payload);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/api/v1/auth/resend-otp", {
        method: "POST",
        body: { challenge_token: challenge },
        auth: false,
      });
      setNotice("A new code is on its way.");
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid [background-size:44px_44px] opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl" />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-start gap-2">
          <BrandLogo className="h-12 w-auto max-w-full object-contain" />

          <p className="label-eyebrow">Backoffice</p>
        </div>
        <div className="panel p-6">
          <h1 className="font-display text-lg font-semibold">
            {step === "credentials" ? "Sign in" : "Enter your code"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "credentials"
              ? "Credentials are verified, then a one-time code is emailed to you."
              : "Six digits, valid for a few minutes."}
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (step === "credentials" ? submitCredentials() : submitOtp());
            }}
          >
            {step === "credentials" ? (
              <>
                <Field label="Email">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="Password">
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-surface px-3 pr-10 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" strokeWidth={2} />
                      ) : (
                        <Eye className="size-4" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </Field>
              </>
            ) : (
              <Field label="One-time code">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="num h-12 w-full rounded-md border border-input bg-surface px-3 text-center text-xl tracking-[0.5em] outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
                />
              </Field>
            )}

            <ApiErrorBox error={error} />
            {notice ? (
              <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                {notice}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              ) : step === "credentials" ? (
                <ArrowRight className="size-4" strokeWidth={2} />
              ) : (
                <ShieldCheck className="size-4" strokeWidth={2} />
              )}
              {step === "credentials" ? "Continue" : "Verify and sign in"}
            </button>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {step === "credentials" ? (
                <Link to="/forgot-password" className="hover:text-foreground">
                  Forgot password?
                </Link>
              ) : (
                <>
                  <button type="button" onClick={() => void resendOtp()} className="hover:text-foreground">
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("credentials");
                      setOtp("");
                      setNotice(null);
                    }}
                    className="hover:text-foreground"
                  >
                    Use another account
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" strokeWidth={1.75} />
          Single-session enforced · tokens stay in this browser
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
    </label>
  );
}
