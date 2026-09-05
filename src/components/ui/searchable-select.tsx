import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

export function SearchableSelect({
  id,
  value,
  options,
  placeholder,
  required,
  disabled,
  buttonClassName,
  onChange,
}: {
  id?: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query));
  }, [options, search]);

  return (
    <div className="relative flex flex-col gap-1" ref={ref}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={cn(
          "num flex h-9 w-full items-center justify-between rounded-md border bg-surface px-3 text-sm text-left outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring focus-visible:outline-none",
          required && !value && "border-primary/40",
          disabled && "cursor-not-allowed opacity-70",
          buttonClassName,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption?.label || placeholder || "Select..."}
        </span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-input bg-surface shadow-xl">
          <div className="flex items-center gap-2 border-b border-muted/20 px-2 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={placeholder ? `Search ${placeholder.toLowerCase()}...` : "Search..."}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-primary/70 focus:ring-0"
            />
          </div>
          <div className="max-h-64 overflow-y-auto px-1 py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results found.</p>
            ) : (
              filteredOptions.map((option) => (
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
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
