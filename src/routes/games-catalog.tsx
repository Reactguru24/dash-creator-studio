import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Inbox } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ReferenceSelect } from "@/components/dashboard/reference-select";
import { StakeLimitsCell } from "@/components/dashboard/stake-limits-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, metaNumber, normalizeList, type Dict } from "@/lib/api";
import { formatCellValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, useClientScope } from "@/lib/use-auth";

export const Route = createFileRoute("/games-catalog")({
  head: () => ({
    meta: [
      { title: "Games catalogue · EuroVirtuals Backoffice" },
      {
        name: "description",
        content: "Browse the live game catalogue enabled for each client operator.",
      },
      { property: "og:title", content: "Games catalogue · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "Browse the live game catalogue enabled for each client operator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamesCatalogPage,
});

function str(row: Dict, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function gameName(row: Dict): string {
  return str(row, ["game_name", "master_game_name", "partner_game_name", "name"]) || "Untitled game";
}

function Thumbnail({ row }: { row: Dict }) {
  const thumb = str(row, ["thumbnail", "thumb", "thumbnail_url", "image", "image_url"]);
  return (
    <div className="flex h-9 w-14 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
      {thumb ? (
        <img src={thumb} alt={gameName(row)} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-muted-foreground">No image</span>
      )}
    </div>
  );
}

function StatusPill({ value }: { value: unknown }) {
  const active = String(value) === "1" || String(value).toLowerCase() === "active";
  return (
    <span
      className={cn(
        "num inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        active
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

type Column = {
  key: string;
  label: string;
  render: (row: Dict) => React.ReactNode;
  align?: "right";
};




const COLUMNS: Column[] = [
  { key: "thumbnail", label: "Game image", render: (row) => <Thumbnail row={row} /> },
  {
    key: "game",
    label: "Game",
    render: (row) => (
      <span className="block max-w-[16rem] truncate" title={gameName(row)}>
        {gameName(row)}
        <span className="num ml-1 text-[11px] text-muted-foreground">#{formatCellValue(row.game_id)}</span>
      </span>
    ),
  },
  {
    key: "limits",
    label: "Limits",
    render: (row) => <StakeLimitsCell row={row} />,
  },
  {
    key: "game_uuid",
    label: "Game UUID",
    render: (row) => (
      <span className="num block max-w-[14rem] truncate" title={formatCellValue(row.game_uuid)}>
        {formatCellValue(row.game_uuid)}
      </span>
    ),
  },
  {
    key: "priority",
    label: "Priority",
    align: "right",
    render: (row) => <span className="num">{formatCellValue(row.priority)}</span>,
  },
  { key: "status", label: "Status", render: (row) => <StatusPill value={row.status} /> },
];

function GamesCatalogPage() {
  const { user, ready, token } = useAuth();
  const scope = useClientScope(user);
  const [manualOperator, setManualOperator] = useState("");
  const [search, setSearch] = useState("");
  const [appliedName, setAppliedName] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Client admins are scoped automatically: single-client accounts resolve the
  // operator from the session, multi-client accounts use the active client.
  const operatorId = scope.clientAdmin ? (scope.singleClient ? "" : scope.operatorId ?? "") : manualOperator;
  const needsOperator = !scope.clientAdmin && !manualOperator;
  const allowed = scope.clientAdmin;

  // Filters are reactive: changes debounce into the applied query, no Apply button.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedName((prev) => {
        if (prev === search) return prev;
        setPage(1);
        return search;
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page, per_page: perPage };
    if (operatorId) params.operator_id = operatorId;
    if (appliedName.trim()) params.game_name = appliedName.trim();
    return params;
  }, [page, perPage, operatorId, appliedName]);

  const query = useQuery({
    queryKey: ["games-catalog", queryParams],
    enabled: ready && Boolean(token) && allowed && !needsOperator,
    queryFn: async () => {
      const payload = await apiRequest("/api/v1/operator-games", { query: queryParams });
      return normalizeList(payload);
    },
    retry: false,
  });

  const list = query.data ?? { rows: [], meta: null, raw: null };
  const total = metaNumber(list.meta, ["total", "total_items", "count", "total_records"]);
  const lastPage = metaNumber(list.meta, ["last_page", "total_pages", "pages"]);
  const rows = list.rows;
  const error = query.error ? (query.error as Error).message : null;

  if (ready && token && !allowed) {
    return (
      <DashboardShell title="Games catalogue" subtitle="Client admin access only.">
        <div className="panel p-6 text-sm text-muted-foreground">
          This page is available to client admin accounts only.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Games catalogue" subtitle="Games enabled for each client operator.">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {!scope.clientAdmin ? (
          <div className="w-64">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="catalog-operator">
              Client
            </label>
            <ReferenceSelect
              id="catalog-operator"
              kind="operator"
              value={manualOperator}
              onChange={(value) => {
                setManualOperator(value);
                setPage(1);
              }}
            />
          </div>
        ) : null}
        <div className="w-64">
          <label className="mb-1 block text-xs text-muted-foreground" htmlFor="catalog-search">
            Search
          </label>
          <input
            id="catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Game name"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {needsOperator ? (
        <p className="panel p-6 text-sm text-muted-foreground">
          Select a client to view its games catalogue.
        </p>
      ) : query.isLoading ? (
        <div className="panel space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full bg-muted/60" />
          ))}
        </div>
      ) : error ? (
        <div className="panel flex items-start gap-3 border-destructive/40 p-6">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={1.75} />
          <div>
            <p className="font-display text-sm font-semibold">Request failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Inbox className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-display text-sm font-semibold">No games found</p>
          <p className="max-w-md text-sm text-muted-foreground">No games are enabled for this client.</p>
        </div>
      ) : (
        <>
          {typeof total === "number" ? (
            <p className="num mb-2 text-xs text-muted-foreground">
              {total.toLocaleString("en-GB")} games
            </p>
          ) : null}
          <div className="panel overflow-hidden">
            <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/60">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "label-eyebrow whitespace-nowrap px-3 py-3 text-left font-normal sm:px-4",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={(row.id as number | string | undefined) ?? index}
                      className="border-b border-border/60 transition-colors last:border-0"
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "whitespace-nowrap px-3 py-2.5 align-middle sm:px-4",
                            col.align === "right" && "text-right",
                          )}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="num text-xs text-muted-foreground">
              Page {page}
              {lastPage ? ` of ${lastPage}` : ""} · {rows.length} rows
              {total !== null ? ` · ${total.toLocaleString("en-GB")} total` : ""}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value));
                  setPage(1);
                }}
                className="num h-8 rounded-md border border-input bg-surface px-2 text-xs"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1 || query.isFetching}
                className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={query.isFetching || (lastPage !== null && page >= lastPage)}
                className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

    </DashboardShell>
  );
}
