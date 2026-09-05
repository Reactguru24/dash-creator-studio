import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Banner shown on pages whose live API is not wired up yet. */
export function ComingSoonBanner({
  className,
  note = "This section is not connected to the live API yet. Everything below is demo data used to preview the final layout.",
}: {
  className?: string;
  note?: string;
}) {
  return (
    <div
      className={cn(
        "panel mb-5 flex items-start gap-3 border-primary/40 bg-primary/5 p-4",
        className,
      )}
    >
      <Clock className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-display text-sm font-semibold text-primary">
          Coming soon
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-normal uppercase tracking-wide">
            Awaiting API
          </span>
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}
