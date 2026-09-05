import { useState } from "react";
import type { Dict } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfigCell({ row, field = "config" }: { row: Dict; field?: string }) {
  const [open, setOpen] = useState(false);
  const value = row[field] ?? row.config ?? row.configs;
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
  }
  const json = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={(event) => event.stopPropagation()}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          View
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl border-border bg-card"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="font-display">
            {typeof row.name === "string" ? `${row.name} · config` : "Config"}
          </DialogTitle>
        </DialogHeader>
        <pre className="num max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
          {json}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
