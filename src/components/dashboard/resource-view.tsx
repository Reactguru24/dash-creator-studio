import { useMutation, useQuery } from "@tanstack/react-query";

import { useEffect, useMemo, useState } from "react";
import { apiRequest, metaNumber, normalizeList, type Dict, type QueryValue } from "@/lib/api";
import type { ResourceDef } from "@/lib/endpoints";
import { actionsFor, type ActionDef } from "@/lib/actions";
import { useAuth, canAccess, useClientScope, roleAllowed } from "@/lib/use-auth";
import { useReferenceStore } from "@/lib/stores/reference-store";
import { DataTable } from "./data-table";
import { StakeLimitsCell } from "./stake-limits-cell";
import {
  ExchangeRateCell,
  FreebetStatusCell,
  LocationCell,
  CallbackVersionCell,
  StatusCell,
  ThumbnailCell,
  TransactionTypeCell,
  MoneyCell,
} from "./cell-renderers";
import { ConfigCell } from "./config-cell";
import { FilterBar } from "./filter-bar";
import { ActionDialog } from "./action-dialog";
import { CredentialsBanner, extractCredentials, type IssuedCredentials } from "./credentials-banner";
import { ApiErrorBox } from "./api-error";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/format";


function initialValues(resource: ResourceDef): Record<string, QueryValue> {
  const values: Record<string, QueryValue> = {};
  // Date filters default to today so every screen opens on the current day.
  for (const filter of resource.filters ?? [])
    values[filter.name] = filter.type === "date" ? todayISO() : "";
  return { ...values, ...(resource.defaults ?? {}) };
}

export function ResourceView({ resource }: { resource: ResourceDef }) {
  const [values, setValues] = useState<Record<string, QueryValue>>(() => initialValues(resource));
  const [applied, setApplied] = useState<Record<string, QueryValue>>(() => initialValues(resource));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  
  const [pending, setPending] = useState<{ action: ActionDef; row?: Dict } | null>(null);
  const [issued, setIssued] = useState<IssuedCredentials | null>(null);
  const [confirming, setConfirming] = useState<{ action: ActionDef; row?: Dict } | null>(null);

  // Filters are reactive: changes debounce into the applied query, no Apply button.
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied((prev) => {
        const same =
          Object.keys(values).length === Object.keys(prev).length &&
          Object.keys(values).every((key) => values[key] === prev[key]);
        if (same) return prev;
        setPage(1);
        return { ...values };
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [values]);


  const { user, ready } = useAuth();
  const scope = useClientScope(user);
  const rowActions = actionsFor(resource.key, "row").filter(
    (a) => roleAllowed(user, a.roles) && canAccess(user, a.permission),
  );
  const collectionActions = actionsFor(resource.key, "collection").filter(
    (a) => roleAllowed(user, a.roles) && canAccess(user, a.permission),
  );


  // Accounts with more than one client must always scope requests by operator_id;
  // single-client accounts never send it (the API resolves it from the session).
  const multiClient = scope.clients.length > 1;
  const singleClient = scope.singleClient || !multiClient;
  const lockOperator = multiClient && !!scope.operatorId;
  // Client admins pick the operator in the header switcher, never per-page.
  // Admins get the operator dropdown on the page, and it is required.
  const isAdmin = !scope.clientAdmin;
  const hideOperator = !isAdmin;
  const hidePartner = scope.clientAdmin;

  const filters = useMemo(
    () =>
      (resource.filters ?? [])
        .filter((filter) => !((filter.name === "operator_id" || filter.type === "operator") && hideOperator))
        .map((filter) =>
          (filter.name === "operator_id" || filter.type === "operator") && isAdmin
            ? { ...filter, required: true }
            : filter,
        )
        // Partner grouping is a platform-wide concept — hidden from client admins.
        .filter((filter) => !(hidePartner && (filter.type === "partner" || filter.name === "partner_id"))),
    [resource.filters, hideOperator, hidePartner, isAdmin],
  );

  const ensureRef = useReferenceStore((s) => s.ensure);
  const ensureGamesForOperator = useReferenceStore((s) => s.ensureGamesForOperator);

  // Eagerly load reference lists needed by this resource when the page mounts
  // so dropdowns and filters don't have to fetch on first open. The
  // `ensure` helpers in the reference store are idempotent and will skip
  // fetching if data is already loaded or loading.
  useEffect(() => {
    if (!resource.filters || !ready) return;
    let operatorIdForGames: string | undefined;
    if (resource.clientScoped && scope.operatorId) operatorIdForGames = scope.operatorId;
    for (const f of resource.filters) {
      if (f.type === "operator") void ensureRef("operator");
      if (f.type === "partner") void ensureRef("partner");
      if (f.type === "role") void ensureRef("role");
      if (f.type === "permission") void ensureRef("permission");
      if (f.type === "game") {
        if (operatorIdForGames) void ensureGamesForOperator(operatorIdForGames);
        else void ensureRef("game");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.key, resource.filters, resource.clientScoped, ready, scope.operatorId]);


  // Single-client admins are pinned to their own operator.
  useEffect(() => {
    if (!lockOperator || !scope.operatorId) return;
    setValues((prev) => (prev.operator_id === scope.operatorId ? prev : { ...prev, operator_id: scope.operatorId }));
    setApplied((prev) => (prev.operator_id === scope.operatorId ? prev : { ...prev, operator_id: scope.operatorId }));
  }, [lockOperator, scope.operatorId]);

  const missingRequired = filters
    .filter((filter) => filter.required)
    .filter((filter) => !applied[filter.name] && applied[filter.name] !== 0)
    .map((filter) => filter.label);

  const query = useMemo(() => {
    const params: Record<string, QueryValue> = {};
    // Empty filters are dropped so the query key stays stable and we don't
    // refetch just because a blank input changed shape.
    for (const [key, value] of Object.entries(applied)) {
      if (value === "" || value === null || value === undefined) continue;
      params[key] = value;
    }
    // The globally selected client always wins over any stale applied value.
    if (lockOperator && scope.operatorId) params.operator_id = scope.operatorId;
    if (singleClient && !isAdmin) delete params.operator_id;
    if (resource.paginated) {
      params.page = page;
      params.per_page = perPage;
    }
    return params;
  }, [applied, page, perPage, resource.paginated, singleClient, lockOperator, scope.operatorId, isAdmin]);


  const request = useQuery({
    queryKey: [resource.key, query],
    // Wait for the cached session: firing before it resolves would run once
    // unscoped and again with the client scope applied.
    enabled: ready && missingRequired.length === 0,
    queryFn: () => apiRequest(resource.path, { query }),
    retry: false,
  });

  const rawList = useMemo(() => normalizeList(request.data ?? null), [request.data]);
  // Rates are quoted against USD, so the USD → USD row carries no information.
  const list = useMemo(
    () =>
      resource.key === "exchange-rates"
        ? {
            ...rawList,
            rows: rawList.rows.filter(
              (row) => String(row.currency ?? "").toUpperCase() !== "USD",
            ),
          }
        : rawList,
    [rawList, resource.key],
  );

  const total =
    metaNumber(list.meta, ["total", "total_items", "count", "total_records"]) ??
    (resource.key === "operator-games" ? list.rows.length : null);
  const lastPage = metaNumber(list.meta, ["last_page", "total_pages", "pages"]);

  // Actions flagged `confirmFromFilters` reuse the current filter values, so we
  // only confirm instead of opening the parameter modal.
  const confirmParams = useMemo(() => {
    if (!confirming) return {} as Record<string, QueryValue>;
    const params: Record<string, QueryValue> = {};
    for (const field of confirming.action.fields ?? []) {
      const raw = confirming.row?.[field.name] ?? applied[field.name];
      const value = raw as QueryValue | undefined;
      if (value !== undefined && value !== "" && value !== null) params[field.name] = value;
    }
    for (const [queryKey, rowKey] of Object.entries(confirming.action.queryFromRow ?? {})) {
      const raw = confirming.row?.[rowKey];
      if (raw !== undefined && raw !== null && raw !== "") params[queryKey] = raw as QueryValue;
    }
    return params;
  }, [confirming, applied]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!confirming) return null;
      const path = confirming.action.path.replace(
        /\{(\w+)\}/g,
        (_m, key: string) => String(confirming.row?.[key] ?? ""),
      );
      return apiRequest(path, {
        method: confirming.action.method,
        query: Object.keys(confirmParams).length > 0 ? confirmParams : undefined,
      });
    },
    onSuccess: (data) => {
      const dict = data && typeof data === "object" && !Array.isArray(data) ? (data as Dict) : null;
      const description =
        (typeof dict?.status_description === "string" && dict.status_description) ||
        (typeof dict?.message === "string" && dict.message) ||
        undefined;
      toast.success(description ?? `${confirming?.action.label ?? "Request"} succeeded`);
      setConfirming(null);
      void request.refetch();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Request failed");
    },
  });

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-4">

      <FilterBar
        filters={filters}
        locked={lockOperator ? ["operator_id"] : undefined}
        values={values}
        onChange={handleChange}
        busy={request.isFetching}
        onReset={() => {
          const fresh = initialValues(resource);
          if (lockOperator && scope.operatorId) fresh.operator_id = scope.operatorId;
          setValues(fresh);
          setApplied(fresh);
          setPage(1);
        }}
      />

      {collectionActions.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {collectionActions.map((action) => (
            <button
              key={action.key}
              onClick={() => setPending({ action, row: undefined })}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}


      {issued ? <CredentialsBanner credentials={issued} onDismiss={() => setIssued(null)} /> : null}

      {missingRequired.length > 0 ? (
        <div className="panel border-warning/40 px-4 py-6 text-sm text-muted-foreground">
          This endpoint requires <span className="text-warning">{missingRequired.join(", ")}</span>. Results load as
          soon as it's filled in.
        </div>
      ) : (
        <>
          {resource.key === "exchange-rates" ? (
            <p className="panel px-4 py-2.5 text-xs text-muted-foreground">
              Note: all conversions are done in USD — rates shown are per 1 USD, so the USD row is omitted.
            </p>
          ) : null}

          {request.error ? (
            <ApiErrorBox error={request.error} />
          ) : (
            <DataTable
              rows={list.rows}
              columns={resource.columns}
              hideColumns={resource.hideColumns}
              total={resource.key === "operator-games" ? total : undefined}
              statusContext={
                resource.key.includes("freebet")
                  ? "freebet"
                  : resource.key.includes("slip")
                    ? "slip"
                    : resource.key.includes("bet")
                      ? "bet"
                      : undefined
              }
              cellRenderers={{
                config: (row) => <ConfigCell row={row} field="config" />,
                configs: (row) => <ConfigCell row={row} field="configs" />,
                ...(/bets$|bet-attempts|slip/.test(resource.key)
                  ? {}
                  : { status: (row: Dict) => <StatusCell row={row} /> }),
                ...(resource.key === "bets"
                  ? {
                      stake: (row: Dict) => <MoneyCell row={row} field="stake" />,
                      bet_amount: (row: Dict) => <MoneyCell row={row} field="stake" />,
                      stake_amount: (row: Dict) => <MoneyCell row={row} field="stake" />,
                      amount: (row: Dict) => <MoneyCell row={row} field="stake" />,
                      won_amount: (row: Dict) => <MoneyCell row={row} field="won_amount" />,
                      settlement_amount: (row: Dict) => <MoneyCell row={row} field="won_amount" />,
                      win_amount: (row: Dict) => <MoneyCell row={row} field="won_amount" />,
                      payout: (row: Dict) => <MoneyCell row={row} field="won_amount" />,
                    }
                  : {}),
                ...(resource.key === "operator-games"
                  ? {
                      thumbnail: (row: Dict) => <ThumbnailCell row={row} />,
                      stake_limits: (row: Dict) => <StakeLimitsCell row={row} />,
                      status: (row: Dict) => <StatusCell row={row} />,
                    }
                  : resource.key === "games"
                    ? { thumbnail: (row: Dict) => <ThumbnailCell row={row} />, status: (row: Dict) => <StatusCell row={row} /> }
                    : resource.key === "partners"
                      ? {
                          thumbnail: (row: Dict) => <ThumbnailCell row={row} />,
                          status: (row: Dict) => <StatusCell row={row} />,
                        }
                      : resource.key === "exchange-rates"
                        ? { exchange_rate: (row: Dict) => <ExchangeRateCell row={row} /> }
                        : resource.key === "clients"
                          ? {
                              location: (row: Dict) => <LocationCell row={row} />,
                              callback_version: (row: Dict) => <CallbackVersionCell row={row} />,
                              status: (row: Dict) => <StatusCell row={row} />,
                            }
                          : resource.key === "transactions"
                            ? {
                                transaction_type_id: (row: Dict) => <TransactionTypeCell row={row} />,
                                transaction_type: (row: Dict) => <TransactionTypeCell row={row} />,
                                type: (row: Dict) => <TransactionTypeCell row={row} />,
                              }
                            : resource.key === "freebets"
                              ? { status: (row: Dict) => <FreebetStatusCell row={row} /> }
                              : {}),
              }}

              isLoading={request.isLoading}
              rowActions={
                rowActions.length > 0
                  ? (row) => {
                      const statusKey = String(row["status"] ?? "").trim().toLowerCase();
                      const freebetActive = ["1", "active", "true", "yes"].includes(statusKey);
                      if (resource.key === "freebets" && !freebetActive) return null;

                      return (
                        <>
                          {rowActions.map((action) => {
                            // Already queued for posting (is_posted = 10) — no re-queueing.
                            const queued =
                              action.key === "bet-request-posting" &&
                              String(row["is_posted"] ?? "") === "10";
                            return (
                              <button
                                key={action.key}
                                disabled={queued}
                                title={queued ? "Already queued" : undefined}
                                onClick={() =>
                                  action.confirmFromFilters
                                    ? setConfirming({ action, row })
                                    : setPending({ action, row })
                                }
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40",
                                  action.danger
                                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                                )}
                              >
                                {queued ? "Queued" : action.label}
                              </button>
                            );
                          })}
                        </>
                      );
                    }
                  : undefined
              }
            />
          )}


          {resource.paginated ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="num text-xs text-muted-foreground">
                Page {page}
                {lastPage ? ` of ${lastPage}` : ""} · {list.rows.length} rows
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
                  disabled={page === 1 || request.isFetching}
                  className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={
                    request.isFetching ||
                    list.rows.length === 0 ||
                    (lastPage !== null && page >= lastPage)
                  }
                  className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <AlertDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => {
          if (!open) {
            confirmMutation.reset();
            setConfirming(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.action.label ?? "Confirm"}
              {confirming?.row && confirming.action.idKey ? (
                <span className="num ml-2 text-xs text-muted-foreground">
                  #{String(confirming.row[confirming.action.idKey] ?? "")}
                </span>
              ) : null}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will run “{confirming?.action.label ?? "this action"}”. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmMutation.mutate();
              }}
            >
              {confirmMutation.isPending ? "Sending…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pending ? (
        <ActionDialog
          key={`${pending.action.key}-${String(pending.row?.[pending.action.idKey ?? "id"] ?? "new")}`}
          action={pending.action}
          row={pending.row}
          open
          onOpenChange={(open) => !open && setPending(null)}
          onSuccess={(data) => {
            const creds = extractCredentials(data);
            if (creds) setIssued(creds);
            void request.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
