import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon = "TrendingUp",
  tone = "default",
  loading,
  bold,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: "default" | "primary" | "accent" | "warning";
  loading?: boolean;
  bold?: boolean;
}) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[icon] ?? Icons.TrendingUp;
  return (
    <div className="panel relative overflow-hidden p-4">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          tone === "primary" && "bg-primary/70",
          tone === "accent" && "bg-accent/70",
          tone === "warning" && "bg-warning/70",
          tone === "default" && "bg-border-strong",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <p className={cn("label-eyebrow", bold && "font-bold text-foreground")}>{label}</p>
        <Icon
          className={cn(
            "size-4",
            tone === "primary" && "text-primary",
            tone === "accent" && "text-accent",
            tone === "warning" && "text-warning",
            tone === "default" && "text-muted-foreground",
          )}
          strokeWidth={1.75}
        />
      </div>
      <p
        className={cn(
          "num mt-3 font-semibold tracking-tight break-words",
          bold && "font-bold",
          value.length > 44 ? "text-sm" : value.length > 24 ? "text-lg" : "text-2xl",
        )}
      >
        {loading ? "···" : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
