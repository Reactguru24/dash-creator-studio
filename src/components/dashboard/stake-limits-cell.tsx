import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Dict } from "@/lib/api";
import { formatCellValue } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FIELDS: { key: string; label: string }[] = [
  { key: "minimum_stake", label: "Minimum stake" },
  { key: "maximum_stake", label: "Maximum stake" },
  { key: "maximum_win", label: "Maximum win" },
];

type LimitEntry = { currency: string; values: Dict };

function isAmountMap(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Dict);
  return keys.length > 0 && keys.every((key) => /^[a-z]{3}$/i.test(key));
}

/** Accepts a per-currency list/map, per-currency amount maps, or a flat single-currency row. */
function limitEntries(row: Dict): LimitEntry[] {
  const raw = row.stake_limits;
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Dict => !!item && typeof item === "object")
      .map((item) => ({
        currency: String(item.currency ?? item.currency_code ?? "—").toUpperCase(),
        values: item,
      }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Dict)
      .filter(([, value]) => !!value && typeof value === "object")
      .map(([currency, value]) => ({
        currency: currency.toUpperCase(),
        values: value as Dict,
      }));
  }

  // Flat row where each field is itself a { USD: 1, EUR: 2 } map.
  const currencies = new Set<string>();
  for (const field of FIELDS) {
    const value = row[field.key];
    if (isAmountMap(value)) for (const code of Object.keys(value)) currencies.add(code.toUpperCase());
  }
  if (currencies.size > 0) {
    return Array.from(currencies)
      .sort()
      .map((currency) => {
        const values: Dict = {};
        for (const field of FIELDS) {
          const value = row[field.key];
          values[field.key] = isAmountMap(value)
            ? ((value[currency] ?? value[currency.toLowerCase()]) as unknown)
            : value;
        }
        return { currency, values };
      });
  }

  // Last resort: the row may list several currencies in one field.
  const codes = String(row.currency ?? "")
    .split(/[,\s/]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  if (codes.length > 1) return codes.map((currency) => ({ currency, values: row }));
  return [{ currency: codes[0] ?? "—", values: row }];
}

export function StakeLimitsCell({ row }: { row: Dict }) {
  const [open, setOpen] = useState(false);
  const entries = limitEntries(row);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
          View limits
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display">Stake limits</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="label-eyebrow px-3 py-2 font-medium">Currency</th>
                {FIELDS.map((field) => (
                  <th key={field.key} className="label-eyebrow px-3 py-2 text-right font-medium">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {entries.map((entry, index) => (
                <tr key={`${entry.currency}-${index}`}>
                  <td className="num px-3 py-2 font-medium">{entry.currency || "—"}</td>
                  {FIELDS.map((field) => (
                    <td key={field.key} className="num px-3 py-2 text-right tabular-nums">
                      {formatCellValue(entry.values[field.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
