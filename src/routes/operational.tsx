import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Bell, Download } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Section } from "@/components/dashboard/section";
import { formatCompact } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { CLIENT_CONCENTRATION, OPS_ALERTS, PROMO_CONVERSION } from "@/lib/demo-analytics";

export const Route = createFileRoute("/operational")({
  head: () => ({
    meta: [
      { title: "Operational BI · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Client concentration risk, promotional campaign ROI and week-over-week drop alerts for the EuroVirtuals platform.",
      },
      { property: "og:title", content: "Operational BI · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content:
          "Automated BI reporting: GGR concentration, promo conversion and early-warning drop alerts.",
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

function Operational() {
  const totalGgr = CLIENT_CONCENTRATION.reduce((sum, row) => sum + row.ggr, 0);
  const concentration = CLIENT_CONCENTRATION.map((row) => ({
    ...row,
    share: (row.ggr / totalGgr) * 100,
  }));
  const overexposed = concentration.filter((row) => row.share > 35);

  return (
    <DashboardShell
      title="Operational BI"
      subtitle="Concentration risk, promo ROI and early-warning alerts"
    >
      <Section
        title="Early warning alerts"
        hint="Triggered when a client or game drops more than 20% week-over-week, or exposure passes the 35% ceiling."
        demo
        className="mt-0"
        actions={
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "operational-report.csv",
                concentration.map((row) => ({
                  client: row.client,
                  ggr: row.ggr,
                  share_pct: row.share.toFixed(2),
                })),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Export report
          </button>
        }
      >
            <ul className="space-y-2">
              {OPS_ALERTS.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(
                    "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border p-3",
                    alert.severity === "critical"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-warning/40 bg-warning/5",
                  )}
                >
                  {alert.severity === "critical" ? (
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Bell className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section
              title="Client concentration"
              hint={
                overexposed.length > 0
                  ? `${overexposed.map((row) => row.client).join(", ")} exceeds the 35% single-client exposure limit.`
                  : "No client exceeds the 35% exposure limit."
              }
              demo
            >
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
                          stroke={row.share > 35 ? "var(--color-destructive)" : "transparent"}
                          strokeWidth={row.share > 35 ? 2 : 0}
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
                    <span className={cn("num shrink-0", row.share > 35 && "text-destructive")}>
                      {row.share.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Promo conversion"
              hint="Free rounds and welcome bonuses charted against subsequent cash deposits."
              demo
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PROMO_CONVERSION} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="campaign"
                      tick={{ fontSize: 10 }}
                      stroke="var(--color-muted-foreground)"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v: number) => formatCompact(v)}
                      width={52}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="awarded"
                      name="Bonus awarded"
                      fill="var(--color-primary)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="deposited"
                      name="Cash deposited"
                      fill="var(--color-accent)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {PROMO_CONVERSION.map((row) => (
                  <li key={row.campaign} className="flex items-center justify-between gap-3">
                    <span className="truncate text-muted-foreground">{row.campaign}</span>
                    <span className="num shrink-0">
                      {((row.deposited / row.awarded) * 100).toFixed(1)}% conversion
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
    </DashboardShell>
  );
}
