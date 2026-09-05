import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  return (
    <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
      {label}
    </span>
  );
}

export function Section({
  title,
  hint,
  actions,
  demo,
  className,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  demo?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel mt-5 p-4 sm:p-5", className)}>
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-base font-semibold">{title}</h2>
            {demo ? <DemoBadge /> : null}
          </div>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Toggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            value === option.value
              ? "bg-primary/12 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
