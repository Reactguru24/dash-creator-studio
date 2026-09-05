import { Clock } from "lucide-react";

/** Full-page placeholder for sections whose live API is not wired up yet. */
export function ComingSoonPage({
  title,
  note = "This section is not connected to the live API yet. It will light up as soon as the endpoints are available.",
}: {
  title?: string;
  note?: string;
}) {
  return (
    <div className="panel flex min-h-[24rem] flex-col items-center justify-center gap-3 p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
        <Clock className="size-6 text-primary" strokeWidth={1.75} />
      </span>
      <p className="font-display text-xl font-semibold text-foreground">Coming soon</p>
      {title ? (
        <p className="text-sm font-medium text-primary">{title}</p>
      ) : null}
      <p className="max-w-md text-sm text-muted-foreground">{note}</p>
      <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
        Awaiting API
      </span>
    </div>
  );
}
