import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Section, Toggle } from "@/components/dashboard/section";
import { StatsError, StatsFilterBar, useStatsScope } from "@/components/dashboard/stats-filter-bar";
import { formatCompact, formatNumberValue } from "@/lib/format";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { downloadCsv } from "@/lib/csv";
import {
  errorMessage,
  labelOf,
  marginPctOf,
  metricOf,
  rowsFrom,
  rtpOf,
  seriesFrom,
  useStatsSummary,
  useStatsTop,
  type StatsMetricKey,
} from "@/lib/stats";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Financial analytics · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Live GGR, NGR, RTP and run-rate scorecards with per-game margin analysis, CSV export and interactive trend charts.",
      },
      { property: "og:title", content: "Financial analytics · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content: "GGR, NGR, RTP and run rates plus per-game margin analysis for EuroVirtuals operators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function daysBetween(from: string, to: string) {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

const show = (value: number | null) => (value === null ? "—" : formatCompact(value));
const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(2)}%`);

function AnalyticsPage() {
  const { dateFrom, dateTo } = useDashboardStore();
  const { filters, requiresOperator, hideOperator } = useStatsScope();

  const summary = useStatsSummary(filters);
  const byGame = useStatsSummary(filters, "game");

  const [interval, setInterval] = useState<"days" | "months">("days");
  const [axis, setAxis] = useState<StatsMetricKey>("ggr");
  const trend = useStatsTop(interval, axis, filters, 60);

  const payload = summary.data ?? null;
  const ggr = metricOf(payload, "ggr");
  const stake = metricOf(payload, "total_stake");
  const won = metricOf(payload, "total_won");
  const bets = metricOf(payload, "total_bets");
  const players = metricOf(payload, "players");
  const freeBetWon = metricOf(payload, "free_bet_won");

  const rtp = rtpOf(stake, ggr);
  const ngr = ggr === null ? null : ggr - (freeBetWon ?? 0);
  const days = daysBetween(dateFrom, dateTo);
  const dailyRun = ggr === null ? null : ggr / days;
  const hourlyRun = dailyRun === null ? null : dailyRun / 24;

  const trendData = useMemo(() => seriesFrom(trend.data, axis), [trend.data, axis]);

  const gameRows = useMemo(() => {
    const rows = rowsFrom(byGame.data);
    return rows
      .map((row) => {
        const rowGgr = metricOf(row, "ggr", 3);
        const rowStake = metricOf(row, "total_stake", 3);
        return {
          game: labelOf(row, 40),
          total_bets: metricOf(row, "total_bets", 3),
          total_stake: rowStake,
          total_won: metricOf(row, "total_won", 3),
          players: metricOf(row, "players", 3),
          ggr: rowGgr,
          rtp: rtpOf(rowStake, rowGgr),
          margin: marginPctOf(rowStake, rowGgr),
        };
      })
      .sort((a, b) => (b.ggr ?? 0) - (a.ggr ?? 0));
  }, [byGame.data]);

  const exportRows = gameRows.map((row) => ({
    game: row.game,
    total_bets: row.total_bets ?? "",
    total_stake: row.total_stake ?? "",
    total_won: row.total_won ?? "",
    players: row.players ?? "",
    ggr: row.ggr ?? "",
    rtp_pct: row.rtp === null ? "" : row.rtp.toFixed(2),
    margin_pct: row.margin === null ? "" : row.margin.toFixed(2),
  }));

  return (
    <DashboardShell
      title="Financial analytics"
      subtitle="GGR = total stake − total won · RTP = (total stake − GGR) ÷ total stake"
    >
      <StatsFilterBar hideOperator={hideOperator} />
      <StatsError message={errorMessage(summary.error)} />
      {requiresOperator && filters.enabled === false ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Select a client above to load analytics.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="GGR"
          icon="TrendingUp"
          tone="primary"
          loading={summary.isLoading}
          value={show(ggr)}
          hint="Total stake − total won"
        />
        <StatCard
          label="NGR"
          icon="Wallet"
          tone="accent"
          loading={summary.isLoading}
          value={show(ngr)}
          hint="GGR − free bet payouts"
        />
        <StatCard
          label="RTP"
          icon="Percent"
          tone="default"
          loading={summary.isLoading}
          value={pct(rtp)}
          hint={stake === null ? "No stake in range" : `${formatCompact(stake)} staked`}
        />
        <StatCard
          label="Daily run rate"
          icon="CalendarClock"
          tone="default"
          loading={summary.isLoading}
          value={show(dailyRun)}
          hint={`${days} day range`}
        />
        <StatCard
          label="Hourly run rate"
          icon="Clock"
          tone="warning"
          loading={summary.isLoading}
          value={show(hourlyRun)}
          hint="Spot traffic anomalies"
        />
        <StatCard
          label="Total bets"
          icon="Dices"
          tone="default"
          loading={summary.isLoading}
          value={show(bets)}
          hint={players === null ? "Settled + open bets" : `${formatCompact(players)} players`}
        />
      </div>

      <Section
        title="Performance trends"
        hint="Aggregated per day or per month for the selected range and filters."
        actions={
          <>
            <Toggle
              value={interval}
              onChange={(value) => setInterval(value as "days" | "months")}
              options={[
                { label: "Day", value: "days" },
                { label: "Month", value: "months" },
              ]}
            />
            <Toggle
              value={axis}
              onChange={(value) => setAxis(value as StatsMetricKey)}
              options={[
                { label: "GGR", value: "ggr" },
                { label: "Stake", value: "total_stake" },
                { label: "Won", value: "total_won" },
                { label: "Bets", value: "total_bets" },
                { label: "Players", value: "players" },
              ]}
            />
          </>
        }
      >
        <div className="h-64 w-full sm:h-80">
          {trend.isLoading ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">Loading…</div>
          ) : trend.error ? (
            <div className="grid h-full place-items-center px-4 text-center text-xs text-destructive">
              {errorMessage(trend.error)}
            </div>
          ) : trendData.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground">
              No data for this range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCompact(v)} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={axis.replace(/_/g, " ")}
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      <Section
        title="Game performance & margin"
        hint="Stake, wins, GGR, RTP and house margin per game for the selected range."
        actions={
          <button
            type="button"
            disabled={exportRows.length === 0}
            onClick={() => downloadCsv(`game-performance-${dateFrom}_${dateTo}.csv`, exportRows)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Export CSV
          </button>
        }
      >
        <StatsError message={errorMessage(byGame.error)} />
        {byGame.isLoading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : gameRows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No game activity for this range.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/60">
                  {["Game", "Total bets", "Total stake", "Total won", "Players", "GGR", "RTP", "Margin"].map(
                    (head) => (
                      <th
                        key={head}
                        className="label-eyebrow whitespace-nowrap px-3 py-2.5 text-left font-normal"
                      >
                        {head}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {gameRows.map((row) => (
                  <tr key={row.game} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">{row.game}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {row.total_bets === null ? "—" : formatNumberValue(row.total_bets)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {row.total_stake === null ? "—" : formatNumberValue(row.total_stake)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {row.total_won === null ? "—" : formatNumberValue(row.total_won)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {row.players === null ? "—" : formatNumberValue(row.players)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      {row.ggr === null ? "—" : formatNumberValue(row.ggr)}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2.5">{pct(row.rtp)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5">
                      <span
                        className={
                          row.margin === null
                            ? ""
                            : row.margin >= 8
                              ? "text-success"
                              : row.margin >= 5
                                ? "text-warning"
                                : "text-destructive"
                        }
                      >
                        {pct(row.margin)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </DashboardShell>
  );
}
