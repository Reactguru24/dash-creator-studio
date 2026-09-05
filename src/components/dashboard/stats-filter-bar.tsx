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
  const { dateFrom, dateTo, operatorId, gameId, setDateFrom, setDateTo, setOperatorId, setGameId } =
    useDashboardStore();

  return (
    <div className="panel mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <label className="flex flex-col gap-1.5">
        <span className="label-eyebrow">Date from</span>
        <DateField value={dateFrom} onChange={setDateFrom} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label-eyebrow">Date to</span>
        <DateField value={dateTo} onChange={setDateTo} />
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
