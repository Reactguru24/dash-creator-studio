import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Section } from "@/components/dashboard/section";
import { formatCompact, formatNumberValue } from "@/lib/format";
import {
  ACTIVE_SOCKETS,
  BET_SIZE_DISTRIBUTION,
  CCU_NOW,
  CCU_SERIES,
  DAU_MAU_SERIES,
  SESSION_STATS,
} from "@/lib/demo-analytics";

export const Route = createFileRoute("/player-behavior")({
  head: () => ({
    meta: [
      { title: "Player behaviour · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Concurrent users, rolling DAU/MAU retention trends, average session duration and bet-size distribution across pricing tiers.",
      },
      { property: "og:title", content: "Player behaviour · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content:
          "CCU, DAU, MAU, session duration and wager distribution analytics for EuroVirtuals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlayerBehavior,
});

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

function PlayerBehavior() {
  const latestDau = DAU_MAU_SERIES[DAU_MAU_SERIES.length - 1];
  const totalWagers = BET_SIZE_DISTRIBUTION.reduce((sum, tier) => sum + tier.wagers, 0);

  return (
    <DashboardShell
      title="Player behaviour"
      subtitle="Live server load, retention trends and wager distribution"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Concurrent users"
          icon="Radio"
          tone="primary"
          value={formatNumberValue(CCU_NOW)}
          hint="Live now"
        />
        <StatCard
          label="Active WebSockets"
          icon="Cable"
          tone="accent"
          value={formatNumberValue(ACTIVE_SOCKETS)}
          hint="Connections interacting with game instances"
        />
        <StatCard
          label="DAU"
          icon="UserCheck"
          tone="default"
          value={formatCompact(latestDau.dau)}
          hint="Daily active players"
        />
        <StatCard
          label="MAU"
          icon="Users"
          tone="default"
          value={formatCompact(latestDau.mau)}
          hint="Rolling 30-day active players"
        />
      </div>

      <Section title="Concurrent users" hint="Sampled every 5 minutes over the last hour." demo>
        <div className="h-56 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CCU_SERIES} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(v: number) => formatCompact(v)}
                width={52}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="ccu"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        title="DAU vs MAU"
        hint="Rolling 30-day view of daily and monthly active players."
        demo
      >
        <div className="h-56 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={DAU_MAU_SERIES}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="day"
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
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="dau" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              <Line
                type="monotone"
                dataKey="mau"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Session engagement"
          hint="Measured from iframe load to close, counting every finalized wager."
          demo
          className="mt-5"
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Avg session", `${SESSION_STATS.avgSessionMinutes} min`],
              ["Median session", `${SESSION_STATS.medianSessionMinutes} min`],
              ["Rounds / session", String(SESSION_STATS.avgRoundsPerSession)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-surface/50 p-3">
                <dt className="label-eyebrow">{label}</dt>
                <dd className="num mt-1 font-display text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Bet size distribution"
          hint="Wagers grouped into pricing tiers to identify volume drivers."
          demo
          className="mt-5"
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={BET_SIZE_DISTRIBUTION}
                margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="tier"
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v: number) => formatCompact(v)}
                  width={52}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="wagers" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {BET_SIZE_DISTRIBUTION.map((tier) => (
              <li key={tier.tier} className="flex items-center justify-between gap-3">
                <span className="truncate">
                  {tier.tier} <span className="num">({tier.range})</span>
                </span>
                <span className="num shrink-0">
                  {((tier.wagers / totalWagers) * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </DashboardShell>
  );
}
