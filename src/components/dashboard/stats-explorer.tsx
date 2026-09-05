import { useState } from "react";
import { TopStatsChart } from "./top-stats-chart";
import {
  STATS_METRICS,
  TYPES_BY_SCOPE,
  parseOperatorId,
  useDashboardStore,
  type ChartVariant,
  type ExplorerScope,
  type StatsMetric,
  type StatsTopType,
} from "@/lib/stores/dashboard-store";
import { useAuth, useClientScope } from "@/lib/use-auth";

const TYPE_LABELS: Record<StatsTopType, string> = {
  clients: "Clients",
  games: "Games",
  "operator-games": "Operator games",
  partners: "Partners",
  days: "Days",
  months: "Months",
};

const METRIC_LABELS: Record<StatsMetric, string> = {
  ggr: "GGR",
  total_bets: "total bets",
  total_stake: "total stake",
  players: "players",
  total_won: "total won",
  total_voided: "total voided",
};

const VARIANT_LABELS: Record<ChartVariant, string> = {
  line: "Line",
  bar: "Bar",
};

function cardTitle(type: StatsTopType, metric: StatsMetric): string {
  return `Top ${TYPE_LABELS[type]} by ${METRIC_LABELS[metric]}`;
}

export function StatsExplorer() {
  const { dateFrom, dateTo, operatorId, partnerId, gameId } = useDashboardStore();
  const { user } = useAuth();
  const clientScope = useClientScope(user);
  const hidePartner = clientScope.clientAdmin;
  const [metrics, setMetrics] = useState<Partial<Record<StatsTopType, StatsMetric>>>({});
  const [variants, setVariants] = useState<Partial<Record<StatsTopType, ChartVariant>>>({});

  // Single-client admins never send operator_id — the API scopes to their operator.
  const operatorIdNum = clientScope.singleClient ? undefined : parseOperatorId(operatorId);
  const partnerIdNum = hidePartner ? undefined : parseOperatorId(partnerId);
  const gameIdNum = parseOperatorId(gameId);

  // A single selected operator can't be compared against clients/partners/other operators,
  // so that scope gets a reduced set of day/month/game breakdowns.
  const scope: ExplorerScope = operatorIdNum || clientScope.singleClient ? "operator" : "all";

  // Partner breakdowns are platform-wide — hidden from client admins.
  const types = TYPES_BY_SCOPE[scope].filter((type) => !(hidePartner && type === "partners"));

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="font-display text-base font-semibold">Performance breakdown</h2>
        <p className="text-xs text-muted-foreground">
          {scope === "operator"
            ? "Day, month and game breakdowns for the selected operator."
            : "Cross-operator comparisons across clients, partners and games."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {types.map((type) => {
          const metric = metrics[type] ?? "ggr";
          const variant = variants[type] ?? "bar";
          const title = cardTitle(type, metric);
          return (
            <div key={type} className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3">
                <p className="text-sm font-medium">{title}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={metric}
                    onChange={(event) =>
                      setMetrics((prev) => ({ ...prev, [type]: event.target.value as StatsMetric }))
                    }
                    className="h-8 rounded-md border border-input bg-surface px-2 text-xs text-foreground"
                    aria-label={`Metric for ${TYPE_LABELS[type]}`}
                  >
                    {STATS_METRICS.map((option) => (
                      <option key={option} value={option}>
                        {METRIC_LABELS[option]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={variant}
                    onChange={(event) =>
                      setVariants((prev) => ({ ...prev, [type]: event.target.value as ChartVariant }))
                    }
                    className="h-8 rounded-md border border-input bg-surface px-2 text-xs text-foreground"
                    aria-label={`Chart type for ${TYPE_LABELS[type]}`}
                  >
                    {Object.entries(VARIANT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-1">
                <TopStatsChart
                  title={title}
                  type={type}
                  metric={metric}
                  variant={variant}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  operatorId={operatorIdNum}
                  partnerId={partnerIdNum}
                  gameId={gameIdNum}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


