import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectMenuOption = { value: string; label: string };

/** Non-searchable dropdown styled to match ReferenceSelect. */
export function SelectMenu({
  id,
  value,
  options,
  placeholder = "Select",
  onChange,
  className,
  disabled,
  icon,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  options: SelectMenuOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative flex flex-col gap-1", className)} ref={ref}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "num flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-left text-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-input bg-surface shadow-xl">
          <div className="max-h-64 overflow-y-auto px-1 py-1">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No options.</p>
            ) : (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/50",
                    value === option.value && "bg-primary/10",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
