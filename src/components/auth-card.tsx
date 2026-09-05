import { KeyRound } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

/** Shared chrome for the sign-in, forgot-password and reset-password screens. */
export function AuthCard({
  title,
  subtitle,
  onSubmit,
  children,
}: {
  title: string;
  subtitle: string;
  onSubmit?: () => void;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
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
          <h1 className="font-display text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {children}
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
