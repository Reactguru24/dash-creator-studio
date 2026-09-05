import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Date picker bound to an ISO `yyyy-MM-dd` string value. */
export function DateField({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Pick a date",
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "num inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-surface px-2.5 text-left text-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring disabled:opacity-60",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selected ? format(selected, "dd MMM yyyy") : placeholder}</span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
