import { useEffect } from "react";
import { DateField } from "@/components/ui/date-field";
import { ReferenceSelect } from "@/components/dashboard/reference-select";
import { parseOperatorId, useDashboardStore } from "@/lib/stores/dashboard-store";
import { useAuth, useClientScope } from "@/lib/use-auth";
import type { StatsFilters } from "@/lib/stats";

/**
 * Shared date/operator/game filter state for the analytics pages.
 * Values live in the dashboard store so they persist across pages.
 */
export function useStatsScope(): {
  filters: StatsFilters;
  requiresOperator: boolean;
  hideOperator: boolean;
} {
  const { dateFrom, dateTo, operatorId, gameId, setOperatorId } = useDashboardStore();
  const { user } = useAuth();
  const scope = useClientScope(user);
  const hideOperator = scope.mode === "single";
  // Multi-client admins follow whichever client is active in the header switcher.
  const lockOperator = !scope.singleClient && !!scope.operatorId;

  useEffect(() => {
    if (lockOperator && operatorId !== scope.operatorId) setOperatorId(scope.operatorId as string);
  }, [lockOperator, scope.operatorId, operatorId, setOperatorId]);

  const effectiveOperatorId = scope.singleClient
    ? ""
    : lockOperator
      ? (scope.operatorId as string)
      : operatorId;
  const operatorIdNum = parseOperatorId(effectiveOperatorId);
  const requiresOperator = scope.clientAdmin && !scope.singleClient;

  return {
    filters: {
      dateFrom,
      dateTo,
      operatorId: operatorIdNum,
      gameId: parseOperatorId(gameId),
      enabled: !requiresOperator || operatorIdNum !== undefined,
    },
    requiresOperator,
    hideOperator,
  };
}

export function StatsFilterBar({
  hideOperator,
  showGame = true,
}: {
  hideOperator: boolean;
  showGame?: boolean;
}) {
  const { dateFrom, dateTo, operatorId, gameId, setRange, setOperatorId, setGameId } =
    useDashboardStore();

  return (
    <div className="panel mb-5 space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="label-eyebrow">Date range *</span>
          <DateRangeField
            from={dateFrom}
            to={dateTo}
            onChange={(from, to) => setRange(from || todayISO(), to || from || todayISO())}
          />
        </label>
        {hideOperator ? null : (
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="label-eyebrow">Operator</span>
            <ReferenceSelect kind="operator" value={operatorId} onChange={setOperatorId} />
          </label>
        )}
        {showGame ? (
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="label-eyebrow">Game</span>
            <ReferenceSelect
              kind="game"
              value={gameId}
              operatorId={operatorId}
              onChange={setGameId}
            />
          </label>
        ) : null}
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
              type="button"
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
          type="button"
          onClick={() => {
            setRange(defaultDateFrom(), defaultDateTo());
            setOperatorId("");
            setGameId("");
          }}
          className="ml-auto h-9 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

/** Small inline notice shown when a stats request fails. */
export function StatsError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      {message}
    </p>
  );
}
