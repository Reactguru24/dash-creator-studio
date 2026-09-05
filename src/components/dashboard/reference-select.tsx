import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useReferenceStore, type Kind } from "@/lib/stores/reference-store";
import { clientScope, useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

export function useReferenceOptions(kind: Kind, disabled?: boolean, operatorId?: string, active = true) {
  const state = useReferenceStore((s) => s[kind]);
  const ensure = useReferenceStore((s) => s.ensure);
  useEffect(() => {
    // Lazy: reference lists are only fetched when the dropdown is actually used.
    // Prefer cached data: only call `ensure` if the list isn't already loaded
    // or currently loading. Skip operator-scoped game loads here.
    if (!active || disabled || (kind === "game" && operatorId)) return;
    if (state.loaded || state.loading) return;
    void ensure(kind);
  }, [kind, ensure, disabled, operatorId, active, state.loaded, state.loading]);
  return (
    state ?? {
      options: [],
      rows: [],
      loading: false,
      error: null,
      loaded: false,
      promise: null,
    }
  );
}

function rowId(row: Record<string, unknown>, kind?: Kind) {
  // operator-games rows carry their own `id`, but options are keyed by game_id
  if (kind === "game" && row.game_id !== undefined && row.game_id !== null) return row.game_id;
  return row.id ?? row.operator_id ?? row.game_id ?? row.permission_id ?? row.role_id;
}

function rowLabel(row: Record<string, unknown>, options: Option[], kind?: Kind) {
  const id = rowId(row, kind);
  const value = id === undefined || id === null ? "" : String(id);
  return options.find((option) => option.value === value)?.label ?? `#${value}`;
}

function filterRows(
  rows: Record<string, unknown>[],
  options: Option[],
  query: string,
  groupBy?: string,
  kind?: Kind,
) {
  const lowerQuery = query.trim().toLowerCase();
  const matchedRows = rows.filter((row) => {
    if (!lowerQuery) return true;
    const label = rowLabel(row, options, kind).toLowerCase();
    if (label.includes(lowerQuery)) return true;
    if (groupBy) {
      const groupValue = row[groupBy];
      if (typeof groupValue === "string" && groupValue.toLowerCase().includes(lowerQuery)) return true;
    }
    return false;
  });

  if (!groupBy) {
    const seen = new Set<string>();
    const list: Option[] = [];
    for (const row of matchedRows) {
      const id = rowId(row, kind);
      if (id === undefined || id === null) continue;
      const value = String(id);
      if (seen.has(value)) continue;
      seen.add(value);
      list.push({ value, label: rowLabel(row, options, kind) });
    }
    return list;
  }

  const groups = new Map<string, { label: string; options: Option[] }>();
  for (const row of matchedRows) {
    const id = rowId(row, kind);
    if (id === undefined || id === null) continue;
    const rawGroup = row[groupBy];
    const fallbackGroup =
      (groupBy !== "partner_name" && typeof row.partner_name === "string" && row.partner_name) ? row.partner_name : undefined;
    const groupLabel =
      typeof rawGroup === "string" && rawGroup
        ? rawGroup
        : typeof fallbackGroup === "string" && fallbackGroup
          ? fallbackGroup
          : typeof row.partner_id === "number" || typeof row.partner_id === "string"
            ? String(row.partner_id)
            : "Other";
    const key = groupLabel || "Other";
    const group = groups.get(key) ?? { label: key, options: [] };
    group.options.push({ value: String(id), label: rowLabel(row, options, kind) });
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

export function ReferenceSelect({
  kind,
  id,
  value,
  onChange,
  className,
  required,
  operatorId,
  disabled,
  groupBy,
  extraGroup,
}: {
  kind: Kind;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  operatorId?: string;
  disabled?: boolean;
  groupBy?: string;
  /** Extra, non-API options rendered as their own group at the top of the list. */
  extraGroup?: { label: string; options: Option[] };
}) {
  const [open, setOpen] = useState(false);
  // Cache-first: `useReferenceOptions` only calls the API when the list isn't
  // already cached, so requesting it on mount costs nothing on later pages.
  const shouldLoad = true;
  const query = useReferenceOptions(kind, disabled, operatorId, shouldLoad);
  const { user } = useAuth();
  const scope = clientScope(user);
  const scopeKey = scope.ids.join(",");
  // Client admins may only pick the operators assigned to their account.
  const scopedRows = useMemo(() => {
    if (kind !== "operator" || !scope.clientAdmin || scope.ids.length === 0) return query.rows;
    const allowed = new Set(scopeKey.split(",").filter(Boolean));
    return query.rows.filter((row) => allowed.has(String(row.id ?? row.operator_id ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.rows, kind, scope.clientAdmin, scopeKey]);
  const ensureGamesForOperator = useReferenceStore((s) => s.ensureGamesForOperator);
  const ensureGlobal = useReferenceStore((s) => s.ensure);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Single-client admins are resolved from the session, so the games list must
  // be fetched without operator_id. Admins and multi-client accounts send it.
  const operatorScoped = scope.mode !== "single";

  // When the field is required, eagerly load its reference list on mount so
  // forms that depend on operator/operator-games have the data available.
  useEffect(() => {
    if (!required || disabled) return;
    if (kind === "game") {
      if (operatorId && operatorScoped) {
        void ensureGamesForOperator(operatorId);
      } else {
        void ensureGlobal("game");
      }
      return;
    }
    void ensureGlobal(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required, disabled, kind, operatorId, operatorScoped, ensureGamesForOperator, ensureGlobal]);

  useEffect(() => {
    if (kind !== "game" || disabled) return;
    if (operatorId && operatorScoped) {
      void ensureGamesForOperator(operatorId);
    } else {
      void ensureGlobal("game");
    }
  }, [kind, operatorId, disabled, operatorScoped, ensureGamesForOperator, ensureGlobal]);

  // Reference lists (operators, partners, roles…) can go stale when records are
  // created elsewhere in the app, so re-fetch them each time the menu is opened.
  const refresh = useReferenceStore((s) => s.refresh);
  const refreshGamesForOperator = useReferenceStore((s) => s.refreshGamesForOperator);
  useEffect(() => {
    if (!open || disabled) return;
    const term = search.trim();
    // Prefer cached data: only refresh when the list isn't loaded yet or when
    // the user entered a search term.
    if (!query.loaded && !term) return;
    if (kind === "game") {
      if (operatorId && operatorScoped) void refreshGamesForOperator(operatorId, term);
      else void refresh("game", term);
      return;
    }
    void refresh(kind, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, kind, operatorId, operatorScoped, disabled, refresh, refreshGamesForOperator, query.loaded]);





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

  const selected = query.options.find((option) => option.value === value);
  const placeholder =
    kind === "operator"
      ? "Select operator"
      : kind === "partner"
      ? "Select partner group"
      : kind === "game" || kind === "catalogGame"
      ? "Select a game"
      : kind === "role"
      ? "Select role"
      : "Select permission";

  const filtered = useMemo(
    () => filterRows(scopedRows, query.options, search, groupBy, kind),
    [scopedRows, query.options, search, groupBy, kind],
  );
  const options = useMemo(
    () => (!groupBy ? (filtered as Option[]) : ([] as Option[])),
    [filtered, groupBy],
  );

  const groups = useMemo(
    () => (groupBy ? filtered as Array<{ label: string; options: Option[] }> : []),
    [filtered, groupBy],
  );

  const extra = useMemo(() => {
    if (!extraGroup) return null;
    const q = search.trim().toLowerCase();
    const options = q
      ? extraGroup.options.filter(
          (o) => o.label.toLowerCase().includes(q) || extraGroup.label.toLowerCase().includes(q),
        )
      : extraGroup.options;
    return options.length > 0 ? { label: extraGroup.label, options } : null;
  }, [extraGroup, search]);

  const selectedLabel =
    selected?.label ?? extraGroup?.options.find((o) => o.value === value)?.label ?? "";
  const emptyMessage = query.loading ? "Loading…" : "No results found.";

  return (
    <div className={cn("relative flex flex-col gap-1", className)} ref={ref}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={query.loading}
        aria-disabled={disabled || query.loading}
        disabled={disabled || query.loading}
        onClick={() => {
          if (disabled || query.loading) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "num flex h-9 w-full items-center justify-between rounded-md border bg-surface px-3 text-sm text-left outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring",
          required && !value && "border-primary/40",
          (disabled || query.loading) && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate", !selectedLabel && !query.loading && "text-muted-foreground")}>
          {query.loading ? "Loading…" : selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>


      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-input bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-muted/20 px-2 py-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${placeholder.toLowerCase()}...`}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-primary/70 focus:ring-0"
              />
            </div>
            {kind === "game" && !query.loading && typeof query.total === "number" ? (
              <div className="ml-3 text-xs text-muted-foreground">{query.total.toLocaleString("en-GB")} games</div>
            ) : null}
          </div>
          <div className="max-h-64 overflow-y-auto px-1 py-1">
            {extra ? (
              <div className="space-y-1 py-1">
                <div className="px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {extra.label}
                </div>
                {extra.options.map((option) => (
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
                ))}
              </div>
            ) : null}
            {query.loading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
            ) : groupBy ? (
              groups.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="space-y-1 py-1">
                    <div className="px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">{group.label}</div>
                    <div className="space-y-1">
                      {group.options.map((option) => (
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
                      ))}
                    </div>
                  </div>
                ))
              )
            ) : options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
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
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {query.error && !/(operator_id is required)/i.test(query.error) ? (
        <p className="text-[11px] text-warning">
          Could not load {kind} list — {query.error}
        </p>
      ) : null}
    </div>
  );
}

export function MultiReferenceSelect({
  kind,
  id,
  value,
  onChange,
  className,
}: {
  kind: Kind;
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = useReferenceOptions(kind, false, undefined, open || value.length > 0);
  const options = query.options;
  const selected = new Set(value);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

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

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((option) => selected.has(option.value));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) {
      for (const option of filtered) next.delete(option.value);
    } else {
      for (const option of filtered) next.add(option.value);
    }
    onChange(Array.from(next));
  };

  const summary =
    value.length === 0
      ? `Select ${kind}s`
      : value.length <= 2
        ? options
            .filter((option) => selected.has(option.value))
            .map((option) => option.label)
            .join(", ") || `${value.length} selected`
        : `${value.length} selected`;

  return (
    <div className={cn("relative flex flex-col gap-1", className)} ref={ref} id={id}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={query.loading}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "num flex h-9 w-full items-center justify-between rounded-md border border-input bg-surface px-3 text-left text-sm outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-ring",
          query.loading && "cursor-not-allowed opacity-60",
        )}
      >
        <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
          {query.loading ? "Loading…" : summary}
        </span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-input bg-surface shadow-xl">
          <div className="flex items-center gap-2 border-b border-muted/20 px-2 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-primary/70 focus:ring-0"
            />
          </div>
          <div className="border-b border-muted/20 px-2 py-2">
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              {allVisibleSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto px-1 py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No results found.</p>
            ) : (
              filtered.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-sm hover:bg-accent/50"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={selected.has(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
      {query.error && !/(operator_id is required)/i.test(query.error) ? (
        <p className="mt-1 text-[11px] text-warning">Could not load {kind} list — {query.error}</p>
      ) : null}
    </div>
  );
}
