import { AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Dict } from "@/lib/api";
import {
  currencyCodesFromRow,
  deriveColumns,
  formatCellValue,
  humanizeKey,
  isIdKey,
  looksLikeStatus,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { statusMeta } from "@/lib/status-labels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ReadableValue } from "./readable-value";
import { useAuth, isClientAdmin } from "@/lib/use-auth";

import { useReferenceStore, type Kind } from "@/lib/stores/reference-store";

const REFERENCE_COLUMNS: Record<string, Kind> = {
  operator_id: "operator",
  client_id: "operator",
  game_id: "game",
  role_id: "role",
  permission_id: "permission",
};

function useReferenceLookups(_rows: Dict[]) {
  // Label lookups reuse reference lists that are already in the store (loaded
  // on demand by the filter dropdowns). The table never fetches them itself —
  // each page only calls the API it is actually about.
  const operator = useReferenceStore((s) => s.operator);
  const game = useReferenceStore((s) => s.game);
  const role = useReferenceStore((s) => s.role);
  const permission = useReferenceStore((s) => s.permission);


  return useMemo(() => {
    const maps: Partial<Record<Kind, Map<string, string>>> = {};
    const build = (kind: Kind, state: { options: { value: string; label: string }[] }) => {
      const map = new Map<string, string>();
      for (const opt of state.options) map.set(opt.value, opt.label);
      maps[kind] = map;
    };
    build("operator", operator);
    build("game", game);
    build("role", role);
    build("permission", permission);
    return maps;
  }, [operator, game, role, permission]);
}

function lookupLabel(
  col: string,
  value: unknown,
  maps: Partial<Record<Kind, Map<string, string>>>,
): string | null {
  const kind = REFERENCE_COLUMNS[col];
  if (!kind) return null;
  if (value === null || value === undefined || value === "") return null;
  return maps[kind]?.get(String(value)) ?? null;
}


function StatusPill({
  value,
  column,
  context,
}: {
  value: unknown;
  column?: string;
  context?: string;
}) {
  const meta = column ? statusMeta(column, value, context) : null;
  const text = meta?.label ?? formatCellValue(value);
  const positive =
    meta?.tone === "positive" ||
    (!meta && /^(1|10|20|active|success|approved|true|settled|posted|won)$/i.test(text));
  const negative =
    meta?.tone === "negative" ||
    (!meta && /^(0|false|inactive|failed|rejected|revoked|blocked|lost)$/i.test(text));
  const warning = meta?.tone === "warning";
  return (
    <span
      className={cn(
        "num inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        positive && "border-success/40 bg-success/10 text-success",
        negative && "border-destructive/40 bg-destructive/10 text-destructive",
        warning && "border-warning/40 bg-warning/10 text-warning",
        !positive && !negative && !warning && "border-border-strong bg-muted/50 text-muted-foreground",
      )}
      title={meta ? `${meta.label} (${formatCellValue(value)})` : undefined}
    >
      {text}
    </span>
  );
}

export function DataTable({
  rows,
  columns,
  isLoading,
  error,
  emptyHint,
  rowActions,
  hideColumns,
  cellRenderers,
  total,
  statusContext,
}: {
  rows: Dict[];
  columns?: string[];
  hideColumns?: string[];
  isLoading?: boolean;
  error?: string | null;
  emptyHint?: string;
  rowActions?: (row: Dict) => ReactNode;
  cellRenderers?: Record<string, (row: Dict) => ReactNode>;
  total?: number | null;
  statusContext?: string;
}) {
  const { user } = useAuth();
  const clientAdmin = isClientAdmin(user);
  const [selected, setSelected] = useState<Dict | null>(null);
  const lookupMaps = useReferenceLookups(rows);
  // Adds a synthetic `currency` field derived from per-currency amount fields.
  const syntheticKeys = useMemo(() => Object.keys(cellRenderers ?? {}), [cellRenderers]);
  const displayRows = useMemo(
    () =>
      rows.map((row) => {
        let next = row;
        if (!next.currency) {
          const codes = currencyCodesFromRow(next);
          if (codes.length) next = { ...next, currency: codes.join(", ") };
        }
        if (!next.game_name) {
          const nested = (next.game ?? next.games) as Record<string, unknown> | undefined;
          const name =
            (typeof next.master_game_name === "string" && next.master_game_name) ||
            (typeof next.partner_game_name === "string" && next.partner_game_name) ||
            (nested && typeof nested.name === "string" && nested.name) ||
            "";
          if (name) next = { ...next, game_name: name };
        }
        for (const key of syntheticKeys) {
          if (next[key] === undefined) next = { ...next, [key]: "" };
        }
        return next;
      }),
    [rows, syntheticKeys],
  );



  if (isLoading) {
    return (
      <div className="panel space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full bg-muted/60" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex items-start gap-3 border-destructive/40 p-6">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={1.75} />
        <div>
          <p className="font-display text-sm font-semibold">Request failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (displayRows.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
        <Inbox className="size-6 text-muted-foreground" strokeWidth={1.5} />
        <p className="font-display text-sm font-semibold">No records returned</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {emptyHint ?? "Adjust the filters above and run the query again."}
        </p>
      </div>
    );
  }

  const hiddenForClientAdmin = clientAdmin
    ? ["operator_id", "operator", "operatorId", "operator_id_hash", "client_id", "clientId", "id", "balance", "prev_balance", "external_id", "player_token", "last_balance_update"]
    : [];
  const cols = deriveColumns(displayRows, columns, 9, [...(hideColumns ?? []), ...hiddenForClientAdmin]);

  return (
    <>
      {typeof total === "number" ? (
        <p className="num text-xs text-muted-foreground">{total.toLocaleString("en-GB")} games</p>
      ) : null}
      <div className="panel overflow-hidden">
        <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60">
                {cols.map((col) => (
                  <th
                    key={col}
                    className="label-eyebrow whitespace-nowrap px-3 py-3 text-left font-normal sm:px-4"
                  >
                    {humanizeKey(col)}
                  </th>
                ))}
                {rowActions ? (
                  <th className="label-eyebrow whitespace-nowrap px-3 py-3 text-right font-normal sm:px-4">Actions</th>
                ) : null}
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface/40"
                >
                  {cols.map((col) => {
                    const raw = row[col];
                    const label = lookupLabel(col, raw, lookupMaps);
                    const renderer = cellRenderers?.[col];
                    const valueText = formatCellValue(raw, { useGrouping: !isIdKey(col) });
                    return (
                    <td key={col} className="whitespace-nowrap px-3 py-2.5 align-middle sm:px-4">
                      {renderer ? (
                        renderer(row)
                      ) : looksLikeStatus(col) ? (
                        <StatusPill value={raw} column={col} context={statusContext} />
                      ) : label ? (
                        <span
                          className="block max-w-[12rem] truncate sm:max-w-[22rem]"
                          title={`${label} · #${valueText}`}
                        >
                          {label}
                          <span className="num ml-1 text-[11px] text-muted-foreground">#{valueText}</span>
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "block max-w-[12rem] truncate sm:max-w-[22rem]",
                            typeof raw === "number" && "num",
                            isIdKey(col) && "num text-primary",
                          )}
                          title={valueText}
                        >
                          {valueText}
                        </span>
                      )}
                    </td>
                    );
                  })}

                  {rowActions ? (
                    <td
                      className="whitespace-nowrap px-3 py-2 text-right sm:px-4"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1.5">{rowActions(row)}</div>
                    </td>
                  ) : null}
                  <td className="px-2 text-muted-foreground">
                    {!clientAdmin ? (
                      <ChevronRight className="size-4" strokeWidth={1.75} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!clientAdmin ? (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
          <SheetContent className="w-full overflow-y-auto border-border bg-card sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="font-display">Record detail</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-8">
              {selected
                ? Object.entries(selected).map(([key, value]) => {
                    const label = lookupLabel(key, value, lookupMaps);
                    const status = statusMeta(key, value, statusContext);
                    const valueText = formatCellValue(value, { useGrouping: !isIdKey(key) });
                    if (!label && value && typeof value === "object") {
                      return (
                        <div key={key} className="border-b border-border/60 pb-2">
                          <p className="label-eyebrow">{humanizeKey(key)}</p>
                          <div className="mt-1.5">
                            <ReadableValue value={value} />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="border-b border-border/60 pb-2">
                        <p className="label-eyebrow">{humanizeKey(key)}</p>
                        <p className="num mt-1 break-all text-sm">
                          {label
                            ? `${label} · #${valueText}`
                            : status
                              ? `${status.label} (${valueText})`
                              : valueText}
                        </p>
                      </div>
                    );
                  })
                : null}

            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
