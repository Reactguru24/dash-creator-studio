import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CalendarDays } from "lucide-react";

import { apiRequest, type Dict } from "@/lib/api";
import { useAuth, useClientScope } from "@/lib/use-auth";
import { useReferenceStore } from "@/lib/stores/reference-store";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatsExplorer } from "@/components/dashboard/stats-explorer";
import { ReferenceSelect } from "@/components/dashboard/reference-select";
import { SelectMenu } from "@/components/dashboard/select-menu";
import { DateRangeField } from "@/components/ui/date-range-field";
import { formatStatValue, humanizeKey, todayISO } from "@/lib/format";
import { defaultDateFrom, defaultDateTo, monthRange, parseOperatorId, useDashboardStore } from "@/lib/stores/dashboard-store";

/** Current month plus the previous 11, for the month picker. */
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => monthRange(index));


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EuroVirtuals Backoffice · Operations dashboard" },
      {
        name: "description",
        content:
          "Live operations dashboard for the EuroVirtuals backoffice API: GGR, stakes, players, bets, promotions and audit activity in one control room.",
      },
      { property: "og:title", content: "EuroVirtuals Backoffice · Operations dashboard" },
      {
        property: "og:description",
        content: "GGR, stake, player and bet analytics plus promotions and audit tooling for EuroVirtuals operators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

const METRIC_CARDS: { key: string; label: string; icon: string; tone: "primary" | "accent" | "warning" | "default" }[] = [
  { key: "ggr", label: "GGR", icon: "TrendingUp", tone: "primary" },
  { key: "total_stake", label: "Total stake", icon: "Coins", tone: "accent" },
  { key: "total_bets", label: "Total bets", icon: "Dices", tone: "default" },
  { key: "players", label: "Players", icon: "Users", tone: "default" },
  { key: "total_won", label: "Total won", icon: "Trophy", tone: "warning" },
  { key: "total_voided", label: "Total voided", icon: "Ticket", tone: "default" },
];

function findMetric(payload: unknown, key: string): number | null {
  const seek = (value: unknown, depth: number): number | null => {
    if (!value || typeof value !== "object" || depth < 0) return null;
    const dict = value as Dict;
    const direct = dict[key];
    if (typeof direct === "number") return direct;
    if (typeof direct === "string" && direct !== "" && !Number.isNaN(Number(direct))) return Number(direct);
    for (const nested of Object.values(dict)) {
      const found = seek(nested, depth - 1);
      if (found !== null) return found;
    }
    return null;
  };
  return seek(payload, 5);
}

function Overview() {
  const {
    dateFrom,
    dateTo,
    operatorId,
    partnerId,
    gameId,
    setOperatorId,
    setPartnerId,
    setGameId,
    setRange,
  } = useDashboardStore();
  const { user } = useAuth();
  const scope = useClientScope(user);
  const lockOperator = !scope.singleClient && scope.mode === "single" && !!scope.operatorId;
  // Single-client admins never choose an operator — it comes from their account.
  const hideOperator = scope.mode === "single";
  // Partner grouping is platform-wide — hidden from client admins.
  const hidePartner = scope.clientAdmin;

  useEffect(() => {
    if (lockOperator && operatorId !== scope.operatorId) setOperatorId(scope.operatorId as string);
  }, [lockOperator, scope.operatorId, operatorId, setOperatorId]);

  const ensureReference = useReferenceStore((s) => s.ensure);
  useEffect(() => {
    if (!hideOperator) void ensureReference("operator");
    // Only run on mount; operator list is cached in the reference store until
    // the page is refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single-client admins: the API resolves the operator from the session.
  const operatorIdNum = scope.singleClient ? undefined : parseOperatorId(operatorId);
  const partnerIdNum = hidePartner ? undefined : parseOperatorId(partnerId);
  const gameIdNum = parseOperatorId(gameId);

  // Multi-client admins must pick a client before we hit the summary endpoint.
  const requiresOperator = scope.clientAdmin && !scope.singleClient;
  const summaryEnabled = !requiresOperator || operatorIdNum !== undefined;

  const summary = useQuery({
    queryKey: ["stats-summary", dateFrom, dateTo, operatorIdNum, partnerIdNum, gameIdNum],
    retry: false,
    enabled: summaryEnabled,
    queryFn: () =>
      apiRequest("/api/v1/stats/summary", {
        query: {
          date_from: dateFrom,
          date_to: dateTo,
          operator_id: operatorIdNum,
          partner_id: partnerIdNum,
          game_id: gameIdNum,
        },
      }),
  });

  const summaryError = summary.error ? (summary.error as Error).message : null;

  return (
    <DashboardShell
      title="Operations overview"
      subtitle="Platform summary, top performers and recent activity"
    >
      <div className="panel mb-5 space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="label-eyebrow">Date range *</span>
            <DateRangeField
              from={dateFrom}
              to={dateTo}
              onChange={(from, to) => setRange(from || todayISO(), to || from || todayISO())}
            />
          </label>
          {hideOperator ? null : (
            <label className="flex flex-col gap-1.5">
              <span className="label-eyebrow">Operator</span>
              <ReferenceSelect kind="operator" value={operatorId} onChange={setOperatorId} />
            </label>
          )}
          {hidePartner ? null : (
            <label className="flex flex-col gap-1.5">
              <span className="label-eyebrow">Partner</span>
              <ReferenceSelect kind="partner" value={partnerId} onChange={setPartnerId} />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="label-eyebrow">Game</span>
            <ReferenceSelect
              kind="game"
              value={gameId}
              operatorId={operatorId}
              onChange={setGameId}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SelectMenu
            aria-label="Month"
            className="w-48"
            icon={<CalendarDays className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
            placeholder="Custom range"
            value={MONTH_OPTIONS.find((m) => m.from === dateFrom && m.to === dateTo)?.key ?? ""}
            options={MONTH_OPTIONS.map((month) => ({ value: month.key, label: month.label }))}
            onChange={(value) => {
              const picked = MONTH_OPTIONS.find((m) => m.key === value);
              if (picked) setRange(picked.from, picked.to);
            }}
          />

          {[
            { label: "Today", from: todayISO(), to: todayISO() },
            { label: "Yesterday", from: todayISO(-1), to: todayISO(-1) },
            { label: "7d", from: todayISO(-6), to: todayISO() },
            { label: "30d", from: todayISO(-29), to: todayISO() },
            { label: "90d", from: todayISO(-89), to: todayISO() },
          ].map((preset) => {
            const active = dateFrom === preset.from && dateTo === preset.to;
            return (
              <button
                key={preset.label}
                onClick={() => setRange(preset.from, preset.to)}
                className={`h-9 rounded-md border px-3 text-xs transition-colors ${
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              setRange(defaultDateFrom(), defaultDateTo());
              setOperatorId("");
              setPartnerId("");
              setGameId("");
            }}
            className="ml-auto h-9 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Reset filters
          </button>
        </div>
      </div>

      {summaryError ? (
        <p className="panel mb-5 border-destructive/40 px-4 py-3 text-sm text-destructive">
          Summary request failed: {summaryError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {METRIC_CARDS.map((card) => {
          const value = findMetric(summary.data ?? null, card.key);
          return (
            <StatCard
              key={card.key}
              label={card.label}
              icon={card.icon}
              tone={card.tone}
              loading={summary.isLoading}
              value={value === null ? "—" : formatStatValue(value)}
              hint={humanizeKey(card.key)}
            />
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Note: all amounts are shown in <span className="font-semibold">USD</span>.
      </p>

      <StatsExplorer />
    </DashboardShell>
  );
}
