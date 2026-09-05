import { Loader2, RotateCcw } from "lucide-react";
import type { FilterDef } from "@/lib/endpoints";
import type { QueryValue } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ReferenceSelect } from "./reference-select";
import { DateField } from "@/components/ui/date-field";
import { DateRangeField } from "@/components/ui/date-range-field";



export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  busy,
  locked,
}: {
  filters: FilterDef[];
  values: Record<string, QueryValue>;
  onChange: (name: string, value: string) => void;
  onReset: () => void;
  busy?: boolean;
  /** Filters pinned by the signed-in account's client scope. */
  locked?: string[];
}) {
  if (filters.length === 0) return null;

  const operatorSelected = filters
    .filter((filter) => filter.type === "operator")
    .some((filter) => String(values[filter.name] ?? "") !== "");
  const hasOperatorFilter = filters.some((filter) => filter.type === "operator");
  const hasGameFilter = filters.some((filter) => filter.type === "game");
  const gameSelected = filters
    .filter((filter) => filter.type === "game")
    .some((filter) => String(values[filter.name] ?? "") !== "");

  const orderedFilters = [...filters].sort((a, b) => {
    if (a.type === "operator" && b.type !== "operator") return -1;
    if (a.type !== "operator" && b.type === "operator") return 1;
    if (a.type === "game" && b.type !== "game" && a.type !== "operator") return -1;
    if (b.type === "game" && a.type !== "game" && b.type !== "operator") return 1;
    return 0;
  });

  const hasRange =
    filters.some((f) => f.name === "date_from" && f.type === "date") &&
    filters.some((f) => f.name === "date_to" && f.type === "date");

  return (
    <div className="panel grid grid-cols-1 items-end gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:flex lg:flex-wrap">
      {orderedFilters
        .filter((filter) => !(hasRange && filter.name === "date_to"))
        .filter((filter) => {
          // If we have an operator filter, show only operator first. Show game after operator selected,
          // and show the rest only after a game has been selected. If there's no operator filter but
          // a game filter exists, show game first and the rest after game is selected. Otherwise show all.
          if (hasOperatorFilter) {
            if (filter.type === "operator") return true;
            if (filter.type === "game") return operatorSelected;
            return gameSelected;
          }
          if (hasGameFilter) {
            if (filter.type === "game") return true;
            return gameSelected;
          }
          return true;
        })
        .map((filter) =>
        hasRange && filter.name === "date_from" ? (
          <div key="date-range" className="flex min-w-0 flex-col gap-1.5 lg:min-w-[16rem] lg:flex-1">
            <label htmlFor="date-range" className="label-eyebrow">
              Date range
            </label>
            <DateRangeField
              id="date-range"
              from={String(values["date_from"] ?? "")}
              to={String(values["date_to"] ?? "")}
              disabled={locked?.includes("date_from")}
              onChange={(from, to) => {
                onChange("date_from", from);
                onChange("date_to", to);
              }}
            />
          </div>
        ) : (
        <div key={filter.name} className="flex min-w-0 flex-col gap-1.5 lg:min-w-[9.5rem] lg:flex-1">
          <label htmlFor={filter.name} className="label-eyebrow">
            {filter.label}
            {locked?.includes(filter.name) ? " · locked to your client" : filter.required ? " *" : ""}
          </label>
          {filter.type === "operator" || filter.type === "game" || filter.type === "partner" ? (
            <ReferenceSelect
              id={filter.name}
              kind={filter.type}
              required={filter.required}
              disabled={locked?.includes(filter.name)}
              operatorId={String(values["operator_id"] ?? "")}
              value={String(values[filter.name] ?? "")}
              onChange={(value) => onChange(filter.name, value)}
            />
          ) : filter.type === "select" ? (
            <select
              id={filter.name}
              value={String(values[filter.name] ?? "")}
              onChange={(event) => onChange(filter.name, event.target.value)}
              className="num h-9 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring"
            >
              {(filter.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : filter.type === "date" ? (
            <DateField
              id={filter.name}
              value={String(values[filter.name] ?? "")}
              disabled={locked?.includes(filter.name)}
              placeholder={filter.placeholder ?? "Pick a date"}
              onChange={(value) => onChange(filter.name, value)}
              className={cn(filter.required && "border-primary/40")}
            />
          ) : (
            <input
              id={filter.name}
              type={filter.type === "number" ? "number" : "text"}
              value={String(values[filter.name] ?? "")}
              placeholder={filter.placeholder}
              disabled={locked?.includes(filter.name)}
              onChange={(event) => onChange(filter.name, event.target.value)}
              className={cn(
                "num h-9 rounded-md border border-input bg-surface px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-2 focus:ring-ring",
                filter.required && "border-primary/40",
              )}
            />
          )}
        </div>
        ),
      )}

      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
        {busy ? (
          <span className="inline-flex h-9 items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            Updating
          </span>
        ) : null}
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
          Reset
        </button>
      </div>
    </div>
  );
}
