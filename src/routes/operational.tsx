import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AlertTriangle, Download } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Section } from "@/components/dashboard/section";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  StatsError,
  StatsFilterBar,
  useStatsScope,
} from "@/components/dashboard/stats-filter-bar";
import { formatCompact } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  errorMessage,
  labelOf,
  metricOf,
  rowsFrom,
  useStatsSummary,
  useStatsTop,
} from "@/lib/stats";

export const Route = createFileRoute("/operational")({
  head: () => ({
    meta: [
      { title: "Operational BI · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Live client concentration risk and exposure alerts built from the backoffice stats API for the selected date range.",
      },
      { property: "og:title", content: "Operational BI · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "GGR concentration by client with single-client exposure alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Operational,
});

const SLICE_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-muted-foreground)",
];

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

const EXPOSURE_LIMIT = 35;

function Operational() {
  const { filters, requiresOperator, hideOperator } = useStatsScope();
  const summary = useStatsSummary(filters);
  const topClients = useStatsTop("clients", "ggr", filters, 20);

  const totalGgr = metricOf(summary.data ?? null, "ggr");
  const totalStake = metricOf(summary.data ?? null, "total_stake");
  const totalPlayers = metricOf(summary.data ?? null, "players");

  const concentration = useMemo(() => {
    const rows = rowsFrom(topClients.data)
      .map((row) => ({ client: labelOf(row, 28), ggr: metricOf(row, "ggr", 3) ?? 0 }))
      .filter((row) => row.ggr > 0)
      .sort((a, b) => b.ggr - a.ggr);
    const sum = rows.reduce((acc, row) => acc + row.ggr, 0);
    return rows.map((row) => ({ ...row, share: sum > 0 ? (row.ggr / sum) * 100 : 0 }));
  }, [topClients.data]);

  const overexposed = concentration.filter((row) => row.share > EXPOSURE_LIMIT);

  return (
    <DashboardShell
      title="Operational BI"
      subtitle="Client concentration and exposure alerts for the selected range"
    >
      <StatsFilterBar hideOperator={hideOperator} showGame={false} />
      <StatsError message={errorMessage(topClients.error) ?? errorMessage(summary.error)} />
      {requiresOperator && filters.enabled === false ? (
        <p className="mb-4 text-xs text-muted-foreground">Select a client above to load reporting.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total GGR"
          icon="TrendingUp"
          tone="primary"
          loading={summary.isLoading}
          value={totalGgr === null ? "—" : formatCompact(totalGgr)}
          hint="Across all clients in range"
        />
        <StatCard
          label="Total stake"
          icon="Wallet"
          tone="accent"
          loading={summary.isLoading}
          value={totalStake === null ? "—" : formatCompact(totalStake)}
          hint="Handle for the selected range"
        />
        <StatCard
          label="Active clients"
          icon="Users"
          tone="default"
          loading={topClients.isLoading}
          value={String(concentration.length)}
          hint={
            totalPlayers === null ? "Clients with GGR in range" : `${formatCompact(totalPlayers)} players`
          }
        />
      </div>

      <Section
        title="Exposure alerts"
        hint={`Raised when a single client contributes more than ${EXPOSURE_LIMIT}% of GGR in the selected range.`}
        className="mt-5"
      >
        {topClients.isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : overexposed.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No client exceeds the {EXPOSURE_LIMIT}% exposure limit.
          </p>
        ) : (
          <ul className="space-y-2">
            {overexposed.map((row) => (
              <li
                key={row.client}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.client} over exposure limit</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.share.toFixed(1)}% of total GGR ({formatCompact(row.ggr)}) in the selected range.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Client concentration"
        hint={
          overexposed.length > 0
            ? `${overexposed.map((row) => row.client).join(", ")} exceeds the ${EXPOSURE_LIMIT}% single-client exposure limit.`
            : `No client exceeds the ${EXPOSURE_LIMIT}% exposure limit.`
        }
        actions={
          <button
            type="button"
            disabled={concentration.length === 0}
            onClick={() =>
              downloadCsv(
                `client-concentration-${filters.dateFrom}_${filters.dateTo}.csv`,
                concentration.map((row) => ({
                  client: row.client,
                  ggr: row.ggr,
                  share_pct: row.share.toFixed(2),
                })),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Export report
          </button>
        }
      >
        {topClients.isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : concentration.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No client activity for this range.
          </p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={concentration}
                    dataKey="ggr"
                    nameKey="client"
                    cx="50%"
                    cy="45%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                  >
                    {concentration.map((row, index) => (
                      <Cell
                        key={row.client}
                        fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                        stroke={row.share > EXPOSURE_LIMIT ? "var(--color-destructive)" : "transparent"}
                        strokeWidth={row.share > EXPOSURE_LIMIT ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => formatCompact(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {concentration.map((row) => (
                <li key={row.client} className="flex items-center justify-between gap-3">
                  <span className="truncate text-muted-foreground">{row.client}</span>
                  <span
                    className={cn("num shrink-0", row.share > EXPOSURE_LIMIT && "text-destructive")}
                  >
                    {row.share.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </DashboardShell>
  );
}
