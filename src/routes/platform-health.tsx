import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Bug } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { Section } from "@/components/dashboard/section";
import { cn } from "@/lib/utils";
import {
  ERROR_STREAM,
  LATENCY_BOUNDARY_MS,
  LATENCY_ENDPOINTS,
  LATENCY_MATRIX,
  LATENCY_WARN_MS,
} from "@/lib/demo-analytics";

export const Route = createFileRoute("/platform-health")({
  head: () => ({
    meta: [
      { title: "Platform health · EuroVirtuals Backoffice" },
      {
        name: "description",
        content:
          "Latency matrix across integrated clients, live error stream with debugging metadata, and transaction failure alerts.",
      },
      { property: "og:title", content: "Platform health · EuroVirtuals Backoffice" },
      {
        property: "og:description",
        content:
          "Game loading times, callback latency per client and a real-time client-side error stream.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformHealth,
});

function latencyTone(ms: number) {
  if (ms > LATENCY_BOUNDARY_MS) return "bg-destructive/15 text-destructive";
  if (ms > LATENCY_WARN_MS) return "bg-warning/15 text-warning";
  return "text-muted-foreground";
}

function PlatformHealth() {
  const [openError, setOpenError] = useState<string | null>(ERROR_STREAM[0]?.id ?? null);
  const failureRate = 1.8;

  return (
    <DashboardShell
      title="Platform health"
      subtitle="Hydration times, callback latency and client-side error telemetry"
    >
      {failureRate > 1.5 ? (
        <div className="panel mb-5 flex items-start gap-3 border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-destructive"
            strokeWidth={1.75}
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-destructive">
              Transaction failure rate at {failureRate}% in the last minute
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Above the 1.5% global spike threshold — Rocket Queen on PariPesa is driving the
              spike.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Median hydration"
              icon="Gauge"
              tone="primary"
              value="812 ms"
              hint="Game iframe first paint (SDK reported)"
            />
            <StatCard
              label="p95 hydration"
              icon="Timer"
              tone="warning"
              value="2.14 s"
              hint="Slowest decile of game launches"
            />
            <StatCard
              label="Failed launches (1h)"
              icon="CircleSlash"
              tone="default"
              value="37"
              hint="Iframe init + token rejections"
            />
            <StatCard
              label="Transaction failures"
              icon="TriangleAlert"
              tone="warning"
              value={`${failureRate}%`}
              hint="Rolling 1-minute window"
            />
          </div>

          <Section
            title="Latency matrix"
            hint={`Average callback response time per client and endpoint. Amber above ${LATENCY_WARN_MS}ms, red above ${LATENCY_BOUNDARY_MS}ms over a rolling 5-minute window.`}
            demo
          >
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/60">
                    <th className="label-eyebrow px-3 py-2.5 text-left font-normal">Client</th>
                    {LATENCY_ENDPOINTS.map((endpoint) => (
                      <th
                        key={endpoint}
                        className="label-eyebrow num px-3 py-2.5 text-left font-normal"
                      >
                        {endpoint}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LATENCY_MATRIX.map((row) => (
                    <tr key={row.client} className="border-b border-border/60 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium">{row.client}</td>
                      {row.values.map((ms, index) => (
                        <td key={LATENCY_ENDPOINTS[index]} className="px-2 py-1.5">
                          <span
                            className={cn(
                              "num inline-flex w-full justify-center rounded-md px-2 py-1.5",
                              latencyTone(ms),
                            )}
                          >
                            {ms} ms
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Live error stream"
            hint="Failed wallet handshakes, interrupted crash loops, iframe init failures and script exceptions."
            demo
          >
            <ul className="space-y-2">
              {ERROR_STREAM.map((event) => {
                const open = openError === event.id;
                return (
                  <li key={event.id} className="rounded-lg border border-border bg-surface/50">
                    <button
                      type="button"
                      onClick={() => setOpenError(open ? null : event.id)}
                      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <Bug className="size-4 shrink-0 text-destructive" strokeWidth={1.75} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{event.message}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {event.kind} · {event.clientId}
                        </span>
                      </span>
                      <span className="num shrink-0 text-xs text-muted-foreground">{event.at}</span>
                    </button>
                    {open ? (
                      <dl className="grid gap-2 border-t border-border/60 px-3 py-3 text-xs sm:grid-cols-2">
                        {[
                          ["Client ID", event.clientId],
                          ["Player session token", event.sessionToken],
                          ["Device / browser", event.device],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="label-eyebrow">{label}</dt>
                            <dd className="num truncate">{value}</dd>
                          </div>
                        ))}
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="label-eyebrow">Stack trace</dt>
                          <dd className="num mt-1 overflow-x-auto whitespace-pre rounded-md bg-muted/50 p-2 text-[11px]">
                            {event.stack}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
    </DashboardShell>
  );
}
