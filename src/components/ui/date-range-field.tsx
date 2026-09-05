import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const toDate = (value: string) => {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
};

const iso = (date?: Date) => (date ? format(date, "yyyy-MM-dd") : "");

/** Single dropdown that picks both the "from" and "to" dates of a range. */
export function DateRangeField({
  id,
  from,
  to,
  onChange,
  disabled,
  placeholder = "Pick a date range",
  className,
}: {
  id?: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  const committed: DateRange | undefined = fromDate ? { from: fromDate, to: toDateValue } : undefined;
  const [draft, setDraft] = React.useState<DateRange | undefined>(committed);

  React.useEffect(() => {
    if (open) setDraft(committed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to]);

  const label = fromDate
    ? `${format(fromDate, "dd MMM yyyy")} \u2192 ${toDateValue ? format(toDateValue, "dd MMM yyyy") : "\u2026"}`
    : placeholder;

  const draftLabel = draft?.from
    ? `${format(draft.from, "dd MMM yyyy")} \u2192 ${draft.to ? format(draft.to, "dd MMM yyyy") : "\u2026"}`
    : "Select a start and end date";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "num inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-left text-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring disabled:opacity-60",
            !fromDate && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={draft}
          defaultMonth={draft?.from ?? fromDate}
          onSelect={setDraft}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2">
          <span className="num text-xs text-muted-foreground">{draftLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft(undefined)}
              className="h-8 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!draft?.from}
              onClick={() => {
                onChange(iso(draft?.from), iso(draft?.to ?? draft?.from));
                setOpen(false);
              }}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
