import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { useAuth, useClientScope } from "@/lib/use-auth";
import { apiRequest, type Dict } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Section, Toggle } from "@/components/dashboard/section";
import { ReferenceSelect } from "@/components/dashboard/reference-select";
import { DateField } from "@/components/ui/date-field";
import { formatCompact, formatNumberValue } from "@/lib/format";
import { parseOperatorId, useDashboardStore } from "@/lib/stores/dashboard-store";
import { downloadCsv } from "@/lib/csv";
import {
  GAME_PERFORMANCE,
  TREND_SERIES,
  ggrOf,
  marginOf,
  ngrOf,
  trendData,
  type SeriesKey,
  type TrendInterval,
} from "@/lib/demo-analytics";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Financial analytics · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Real-time GGR, NGR, ARPU and run-rate scorecards with per-game margin tiers, CSV export and interactive trend charts.",
      },
      { property: "og:title", content: "Financial analytics · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content:
          "GGR, NGR, ARPU and run rates plus per-game margin analysis for EuroVirtuals operators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-warning)",
  "var(--color-success)",
];

function findMetric(payload: unknown, key: string): number | null {
  const seek = (value: unknown, depth: number): number | null => {
    if (!value || typeof value !== "object" || depth < 0) return null;
    const dict = value as Dict;
    const direct = dict[key];
    if (typeof direct === "number") return direct;
    if (typeof direct === "string" && direct !== "" && !Number.isNaN(Number(direct)))
      return Number(direct);
    for (const nested of Object.values(dict)) {
      const found = seek(nested, depth - 1);
      if (found !== null) return found;
    }
    return null;
  };
  return seek(payload, 5);
}

function daysBetween(from: string, to: string) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function AnalyticsPage() {
  const { dateFrom, dateTo, operatorId, setDateFrom, setDateTo, setOperatorId } =
    useDashboardStore();
  const { user } = useAuth();
  const scope = useClientScope(user);
  const hideOperator = scope.mode === "single";
  // Multi-client admins: follow whichever client is active in the header switcher.
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

  // Multi-client admins must pick a client before we hit the summary endpoint.
  const requiresOperator = scope.clientAdmin && !scope.singleClient;
  const summaryEnabled = !requiresOperator || operatorIdNum !== undefined;

  const summary = useQuery({
    queryKey: ["stats-summary", dateFrom, dateTo, operatorIdNum],
    retry: false,
    enabled: summaryEnabled,
    queryFn: () =>
      apiRequest("/api/v1/stats/summary", {
        query: { date_from: dateFrom, date_to: dateTo, operator_id: operatorIdNum },
      }),
  });

  // GGR comes from the API; the deduction inputs for NGR are not exposed by the
  // staging API, so they fall back to the demo fixture ratios.
  const demoGgr = GAME_PERFORMANCE.reduce((sum, row) => sum + ggrOf(row), 0);
  const demoNgr = GAME_PERFORMANCE.reduce((sum, row) => sum + ngrOf(row), 0);
  const deductionRatio = demoNgr / demoGgr;

  const ggr = findMetric(summary.data ?? null, "ggr") ?? demoGgr;
  const players = findMetric(summary.data ?? null, "players") ?? 62450;
  const bets = findMetric(summary.data ?? null, "total_bets") ?? 4180000;
  const ngr = ggr * deductionRatio;
  const arpu = players > 0 ? ggr / players : 0;
  const days = daysBetween(dateFrom, dateTo);
  const dailyRun = ggr / days;
  const hourlyRun = dailyRun / 24;

  const [interval, setInterval] = useState<TrendInterval>("day");
  const [axis, setAxis] = useState<"ggr" | "volume" | "players">("ggr");
  const [active, setActive] = useState<SeriesKey[]>([...TREND_SERIES]);
  const [vertical, setVertical] = useState<string>("all");

  const trend = useMemo(() => trendData(interval, axis), [interval, axis]);

  const rows = useMemo(
    () => GAME_PERFORMANCE.filter((row) => vertical === "all" || row.vertical === vertical),
    [vertical],
  );

  const exportRows = rows.map((row) => ({
    game: row.game,
    studio: row.studio,
    client: row.client,
    vertical: row.vertical,
    total_bets: row.total_bets,
    total_wins: row.total_wins,
    ggr: ggrOf(row),
    ngr: ngrOf(row),
    margin_pct: marginOf(row).toFixed(2),
  }));

  return (
    <DashboardShell
      title="Financial analytics"
      subtitle="GGR = Total bets − Total wins · NGR = GGR − (bonuses + tax + platform fees)"
    >
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
          <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2 xl:col-span-2">
            <span className="label-eyebrow">Operator</span>
            <ReferenceSelect kind="operator" value={operatorId} onChange={setOperatorId} />
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="GGR"
          icon="TrendingUp"
          tone="primary"
          loading={summary.isLoading}
          value={formatCompact(ggr)}
          hint="Total bets − total wins"
        />
        <StatCard
          label="NGR"
          icon="Wallet"
          tone="accent"
          loading={summary.isLoading}
          value={formatCompact(ngr)}
          hint="GGR − bonuses, tax, platform fees"
        />
        <StatCard
          label="ARPU"
          icon="UserRound"
          tone="default"
          loading={summary.isLoading}
          value={formatNumberValue(Number(arpu.toFixed(2)))}
          hint={`${formatCompact(players)} players in range`}
        />
        <StatCard
          label="Daily run rate"
          icon="CalendarClock"
          tone="default"
          loading={summary.isLoading}
          value={formatCompact(dailyRun)}
          hint={`${days} day range`}
        />
        <StatCard
          label="Hourly run rate"
          icon="Clock"
          tone="warning"
          loading={summary.isLoading}
          value={formatCompact(hourlyRun)}
          hint="Spot traffic anomalies"
        />
        <StatCard
          label="Total bets"
          icon="Dices"
          tone="default"
          loading={summary.isLoading}
          value={formatCompact(bets)}
          hint="Settled + open bets"
        />
      </div>

      <Section
        title="Performance trends"
        hint="Overlay multiple clients on one chart to compare seasonal drops, spikes and growth."
        demo
        actions={
          <>
            <Toggle
              value={interval}
              onChange={(value) => setInterval(value as TrendInterval)}
              options={[
                { label: "Hour", value: "hour" },
                { label: "Day", value: "day" },
                { label: "Week", value: "week" },
                { label: "Month", value: "month" },
              ]}
            />
            <Toggle
              value={axis}
              onChange={(value) => setAxis(value as typeof axis)}
              options={[
                { label: "GGR", value: "ggr" },
                { label: "Volume", value: "volume" },
                { label: "Players", value: "players" },
              ]}
            />
          </>
        }
      >
        <div className="mb-3 flex flex-wrap gap-3">
          {TREND_SERIES.map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={active.includes(key)}
                onChange={(event) =>
                  setActive((prev) =>
                    event.target.checked ? [...prev, key] : prev.filter((item) => item !== key),
                  )
                }
                className="size-3.5 accent-[var(--color-primary)]"
              />
              {key}
            </label>
          ))}
        </div>
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(v: number) => formatCompact(v)}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {TREND_SERIES.filter((key) => active.includes(key)).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        title="Game performance & margin tiers"
        hint="Total bets, wins, GGR and NGR grouped by client, studio and product vertical."
        demo
        actions={
          <>
            <Toggle
              value={vertical}
              onChange={setVertical}
              options={[
                { label: "All", value: "all" },
                { label: "Crash", value: "Crash games" },
                { label: "Slots", value: "Traditional Slots" },
                { label: "Virtuals", value: "Virtuals" },
              ]}
            />
            <button
              type="button"
              onClick={() => downloadCsv(`game-performance-${dateFrom}_${dateTo}.csv`, exportRows)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
              Export CSV
            </button>
          </>
        }
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/60">
                {[
                  "Game",
                  "Studio",
                  "Client",
                  "Vertical",
                  "Total bets",
                  "Total wins",
                  "GGR",
                  "NGR",
                  "Margin",
                ].map((head) => (
                  <th
                    key={head}
                    className="label-eyebrow whitespace-nowrap px-3 py-2.5 text-left font-normal"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const margin = marginOf(row);
                return (
                  <tr key={row.game} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{row.game}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {row.studio}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {row.client}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="rounded-full border border-border-strong bg-muted/50 px-2 py-0.5 text-[11px]">
                        {row.vertical}
                      </span>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {formatNumberValue(row.total_bets)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {formatNumberValue(row.total_wins)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {formatNumberValue(ggrOf(row))}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {formatNumberValue(ngrOf(row))}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      <span
                        className={
                          margin >= 8
                            ? "text-success"
                            : margin >= 5
                              ? "text-warning"
                              : "text-destructive"
                        }
                      >
                        {margin.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </DashboardShell>
  );
}
