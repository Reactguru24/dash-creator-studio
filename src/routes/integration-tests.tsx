import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, PlayCircle, RefreshCw } from "lucide-react";
import { apiRequest, normalizeList, extractMessage, fieldErrors, type Dict } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ScenarioResults } from "@/components/dashboard/scenario-results";
import { Section } from "@/components/dashboard/section";
import { ReferenceSelect, useReferenceOptions } from "@/components/dashboard/reference-select";
import { parseOperatorId } from "@/lib/stores/dashboard-store";
import { currenciesFromClient } from "@/lib/stores/reference-store";
import { useAuth, useClientScope } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/integration-tests")({
  head: () => ({
    meta: [
      { title: "Integration tests · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Run automated callback integration tests against a client and game, and review saved scenario results from the EuroVirtuals API.",
      },
      { property: "og:title", content: "Integration tests · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content:
          "Automated wallet callback test runs and scenario results for operator integrations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationTests,
});

const input =
  "h-9 w-full rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus:border-primary/70 focus:ring-2 focus:ring-ring";

const OMITTED_EXPORT_FIELDS = new Set(["id", "run_uuid", "operator_id", "game_id"]);

/** Strip internal identifiers from exported payloads, at any nesting depth. */
function omitInternalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitInternalFields);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !OMITTED_EXPORT_FIELDS.has(key))
        .map(([key, val]) => [key, omitInternalFields(val)]),
    );
  }
  return value;
}

function scenarioKey(row: Dict): string {
  for (const key of ["key", "scenario", "name", "code", "id"]) {
    const value = row[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return JSON.stringify(row);
}

function scenarioLabel(row: Dict): string {
  for (const key of ["label", "title", "description", "name", "key"]) {
    const value = row[key];
    if (typeof value === "string" && value) return value;
  }
  return scenarioKey(row);
}

function IntegrationTests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scope = useClientScope(user);
  const hideOperator = scope.mode === "single";
  // Client admins with more than one client pick from their own client list.
  const multiClient = scope.clients.length > 1;
  // Single-client admins never send operator_id — the API resolves it from the session.
  const filterOperatorParam = (value: string) => (scope.singleClient ? undefined : parseOperatorId(value));
  const operatorRef = useReferenceOptions("operator");
  const operatorOptions = operatorRef.options;
  const [operatorId, setOperatorId] = useState(scope.operatorId ?? "");
  // Saved-runs filter is independent from the run form's operator selection.
  const [filterOperatorId, setFilterOperatorId] = useState(scope.operatorId ?? "");

  // Keep the run scoped to the globally selected client.
  useEffect(() => {
    if (scope.operatorId && scope.operatorId !== operatorId) setOperatorId(scope.operatorId);
  }, [scope.operatorId, operatorId]);
  useEffect(() => {
    if (scope.operatorId && scope.operatorId !== filterOperatorId)
      setFilterOperatorId(scope.operatorId);
  }, [scope.operatorId, filterOperatorId]);
  const [gameId, setGameId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [playerId, setPlayerId] = useState("operator-player-1001");
  const [playerToken, setPlayerToken] = useState("player-launch-token");
  const [selected, setSelected] = useState<string[]>([]);
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [scenarioSearch, setScenarioSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const operatorName = (id: unknown) => {
    const key = String(id ?? "");
    if (!key) return "Unknown operator";
    const row = operatorRef.rows.find((r) => String(r.id ?? r.operator_id ?? "") === key);
    const name = row?.name ?? row?.operator_name ?? row?.client_name;
    if (typeof name === "string" && name) return name;
    return operatorOptions.find((o) => o.value === key)?.label ?? `Operator ${key}`;
  };

  // The operator the run is scoped to: explicit selection, or the session client.
  const effectiveOperatorId = String(
    operatorId || scope.operatorId || scope.clients[0]?.id || scope.ids[0] || "",
  );

  const listCurrencies = (() => {
    if (!effectiveOperatorId) return [];
    const row = operatorRef.rows.find(
      (r) => String(r.id ?? r.operator_id ?? "") === effectiveOperatorId,
    );
    return currenciesFromClient(row);
  })();

  // Fallback: the clients list row may omit currencies — read the client detail.
  const clientDetail = useQuery({
    queryKey: ["integration-client-currencies", effectiveOperatorId],
    retry: false,
    enabled: Boolean(effectiveOperatorId) && listCurrencies.length === 0,
    queryFn: () => apiRequest(`/api/v1/clients/${effectiveOperatorId}`),
  });

  const operatorCurrencies =
    listCurrencies.length > 0
      ? listCurrencies
      : currenciesFromClient(
          (() => {
            const data = clientDetail.data as Dict | null | undefined;
            if (!data || typeof data !== "object") return undefined;
            const nested = (data.data ?? data.client ?? data.operator) as Dict | undefined;
            return nested && typeof nested === "object" ? nested : data;
          })(),
        );

  // Populate the currency from the selected operator's currencies.
  useEffect(() => {
    if (operatorCurrencies.length === 0) return;
    if (!operatorCurrencies.includes(currency)) setCurrency(operatorCurrencies[0]);
  }, [operatorCurrencies, currency]);


  const scenarios = useQuery({
    queryKey: ["integration-scenarios"],
    retry: false,
    queryFn: () => apiRequest("/api/v1/integration-tests/scenarios"),
  });

  const runs = useQuery({
    queryKey: ["integration-runs", statusFilter, filterOperatorId],
    retry: false,
    // Platform admins may list every run unscoped; multi-client admins must pick a client first.
    enabled: !scope.clientAdmin || scope.singleClient || Boolean(parseOperatorId(filterOperatorId)),
    queryFn: () =>
      apiRequest("/api/v1/integration-tests", {
        query: {
          status: statusFilter || undefined,
          operator_id: filterOperatorParam(filterOperatorId),
          page: 1,
          per_page: 15,
        },
      }),
  });

  const detail = useQuery({
    queryKey: ["integration-run", detailId],
    enabled: Boolean(detailId),
    retry: false,
    queryFn: () => apiRequest(`/api/v1/integration-tests/${detailId}`),
  });

  const run = useMutation({
    mutationFn: () =>
      apiRequest("/api/v1/integration-tests/run", {
        method: "POST",
        body: {
          operator_id: parseOperatorId(operatorId),
          game_id: Number(gameId),
          currency,
          player_id: playerId,
          player_token: playerToken,
          scenarios: selected.length > 0 ? selected : undefined,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-runs"] }),
  });

  const downloadResponses = async () => {
    setDownloading(true);
    try {
      const list = await apiRequest("/api/v1/integration-tests", {
        query: {
          status: statusFilter || undefined,
          operator_id: filterOperatorParam(filterOperatorId),
          page: 1,
          per_page: 200,
        },
      });
      const rows = normalizeList(list).rows;
      const runsWithResults = await Promise.all(
        rows.map(async (row) => {
          const id = row.id;
          let results: unknown = null;
          try {
            results = await apiRequest(`/api/v1/integration-tests/${id}`);
          } catch (error) {
            results = { error: error instanceof Error ? error.message : "Failed to load" };
          }
          return { run: omitInternalFields(row), results: omitInternalFields(results) };
        }),
      );
      const payload = {
        operator_name: operatorName(filterOperatorId),
        exported_at: new Date().toISOString(),
        total_runs: runsWithResults.length,
        runs: runsWithResults,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const slug = operatorName(filterOperatorId)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      link.download = `integration-tests-${slug || "export"}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const scenarioRows = normalizeList(scenarios.data ?? null).rows;
  const filteredScenarioRows = scenarioRows.filter((row) =>
    scenarioLabel(row).toLowerCase().includes(scenarioSearch.trim().toLowerCase()),
  );
  const runRows = normalizeList(runs.data ?? null).rows;
  const detailRows = normalizeList(detail.data ?? null).rows;
  const totalTests = (() => {
    const data = detail.data as Dict | null | undefined;
    const raw = data && typeof data === "object" ? (data.total_tests ?? (data.data as Dict | undefined)?.total_tests) : undefined;
    return typeof raw === "number" ? raw : typeof raw === "string" && raw ? Number(raw) : null;
  })();
  const runError = run.error ? (run.error as Error).message : null;
  const runErrorFields = fieldErrors(
    (run.error as unknown as { payload?: unknown })?.payload ?? null,
  );
  const suppressRunError =
    Boolean((import.meta as any).env?.PROD) &&
    !!runError &&
    /(staging )?api(?: is)? (?:temporarily )?unreachable|temporarily unavailable/i.test(runError);

  return (
    <DashboardShell
      title="Integration tests"
      subtitle="Run and review automated integration test scenarios"
    >
      <Section
        title="Run callback tests"
        hint="Fires the platform's automated wallet callback scenarios against a client integration."
        className="mt-0"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {multiClient ? (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="label-eyebrow">Client</span>
              <select className={input} value={scope.activeClientId ?? ""} disabled>
                {scope.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : hideOperator ? null : (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="label-eyebrow">Operator</span>
              <ReferenceSelect
                kind="operator"
                value={operatorId}
                onChange={(value) => {
                  setOperatorId(value);
                  setGameId("");
                }}
              />
            </label>
          )}
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="label-eyebrow">Game</span>
            <ReferenceSelect
              kind="game"
              value={gameId}
              operatorId={operatorId}
              disabled={!operatorId && !hideOperator}
              onChange={setGameId}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Currency</span>
            {operatorCurrencies.length > 0 ? (
              <select
                className={cn(input, "num")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {operatorCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={cn(input, "num")}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Player ID</span>
            <input
              className={input}
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Player token</span>
            <input
              className={input}
              value={playerToken}
              onChange={(e) => setPlayerToken(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 max-w-md">
          <p className="label-eyebrow mb-2">Scenarios</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setScenariosOpen((open) => !open)}
              className={cn(input, "flex items-center justify-between text-left")}
            >
              <span className="truncate">
                {scenarios.isLoading
                  ? "Loading scenarios…"
                  : selected.length === 0
                    ? "All scenarios"
                    : `${selected.length} scenario${selected.length === 1 ? "" : "s"} selected`}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
            </button>
            {scenariosOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setScenariosOpen(false)} />
                <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-lg">
                  <input
                    autoFocus
                    value={scenarioSearch}
                    onChange={(e) => setScenarioSearch(e.target.value)}
                    placeholder="Search scenarios…"
                    className={cn(input, "mb-1 h-8 text-xs")}
                  />
                  <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-muted-foreground">
                    <span>
                      {selected.length === 0 ? "All scenarios" : `${selected.length} selected`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    {filteredScenarioRows.map((row) => {
                      const key = scenarioKey(row);
                      const checked = selected.includes(key);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelected((prev) =>
                                checked ? prev.filter((v) => v !== key) : [...prev, key],
                              )
                            }
                          />
                          <span className="truncate">{scenarioLabel(row)}</span>
                        </label>
                      );
                    })}
                    {!scenarios.isLoading && filteredScenarioRows.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        {scenarioRows.length === 0
                          ? "No scenarios returned — the run will execute the platform default set."
                          : "No scenarios match your search."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!gameId || (!hideOperator && !operatorId) || run.isPending}
            onClick={() => run.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            <PlayCircle className="size-4" strokeWidth={1.75} />
            {run.isPending ? "Running…" : "Run tests"}
          </button>
          <button
            type="button"
            onClick={() => void runs.refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw
              className={cn("size-3.5", runs.isFetching && "animate-spin")}
              strokeWidth={1.75}
            />
            Refresh runs
          </button>
          {!gameId ? (
            <span className="text-xs text-muted-foreground">Select a game to enable the run.</span>
          ) : null}
        </div>

        {!suppressRunError && runError ? (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <p>{runError}</p>
            {runErrorFields.map((line) => (
              <p key={line} className="text-xs">
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {run.isSuccess ? (
          <p className="mt-3 rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm text-success">
            {extractMessage(run.data) ?? "Test run submitted."}
          </p>
        ) : null}
      </Section>

      <Section
        title="Saved test runs"
        hint="Click a row to load its scenario results."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-end gap-3">
              {multiClient ? (
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="label-eyebrow">Client</span>
                  <select
                    className={input}
                    value={scope.activeClientId ?? ""}
                    onChange={(e) => {
                      scope.setActiveClientId(e.target.value);
                      setFilterOperatorId(e.target.value);
                    }}
                  >
                    {scope.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : hideOperator ? null : (
                <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="label-eyebrow">Operator</span>
                  <ReferenceSelect
                    kind="operator"
                    value={filterOperatorId}
                    onChange={setFilterOperatorId}
                  />
                </label>
              )}
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="label-eyebrow">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(input, "w-36")}
                >
                  <option value="">Any status</option>
                  <option value="RUNNING">Running</option>
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  if (!hideOperator) setFilterOperatorId("");
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <div className="grid max-h-[36rem] gap-2 overflow-auto pr-1">
              {runRows.map((row, index) => {
                const id = String(row.id ?? index);
                const status = String(row.status ?? "—");
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailId(detailId === id ? null : id)}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      detailId === id
                        ? "border-primary/60 bg-primary/5"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="num block truncate text-sm">
                        {(() => {
                          const name =
                            typeof row.operator_name === "string" && row.operator_name
                              ? row.operator_name
                              : operatorName(row.operator_id);
                          return `${String(row.id ?? index)} · ${name}`;
                        })()}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {String(row.created_at ?? row.started_at ?? "")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "num shrink-0 rounded-full border px-2 py-0.5 text-[11px]",
                        status === "PASSED" && "border-success/40 bg-success/10 text-success",
                        status === "FAILED" &&
                          "border-destructive/40 bg-destructive/10 text-destructive",
                        status === "RUNNING" && "border-warning/40 bg-warning/10 text-warning",
                      )}
                    >
                      {status}
                    </span>
                  </button>
                );
              })}
              {runs.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading runs…</p>
              ) : null}
              {runs.error ? (
                <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
                  {(runs.error as Error).message}
                </p>
              ) : null}
              {!runs.isLoading && !runs.error && runRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved test runs for this filter.</p>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-border p-4">
            {detailId ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold">
                    {(() => {
                      const total = totalTests ?? detailRows.length;
                      return `Scenario results · ${total} test${total === 1 ? "" : "s"}`;
                    })()}
                  </h3>
                  <button
                      type="button"
                      disabled={downloading}
                      onClick={() => void downloadResponses()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      <Download className="size-3.5" strokeWidth={1.75} />
                    {downloading ? "Preparing…" : "Download JSON"}
                  </button>
                </div>
                <ScenarioResults
                  rows={detailRows}
                  isLoading={detail.isLoading}
                  error={detail.error ? (detail.error as Error).message : null}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a run on the left to inspect its scenario requests and responses here.
              </p>
            )}
          </div>
        </div>
      </Section>
    </DashboardShell>
  );
}
