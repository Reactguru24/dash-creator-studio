import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Download, XCircle } from "lucide-react";
import type { Dict } from "@/lib/api";
import { cn } from "@/lib/utils";

function pick(row: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function text(row: Dict, keys: string[]): string | undefined {
  const value = pick(row, keys);
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : String(value);
}

export function scenarioName(row: Dict, index: number): string {
  return (
    text(row, ["scenario_name", "scenario", "name", "label", "title", "case", "type", "scenario_key", "key"]) ?? `Scenario ${index}`
  );
}

export function scenarioPassed(row: Dict): boolean {
  const raw = pick(row, ["passed", "success", "ok", "is_success"]);
  if (typeof raw === "boolean") return raw;
  const status = text(row, ["status", "result", "state", "outcome"])?.toUpperCase();
  if (!status) return false;
  return ["PASSED", "PASS", "SUCCESS", "OK", "TRUE", "1"].includes(status);
}

/** Drops raw/unparsed payload mirrors (raw_response, response_raw, raw, …) at any depth. */
function stripRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRaw);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Dict)
        .filter(([key]) => !/(^|_)raw($|_)/i.test(key))
        .map(([key, val]) => [key, stripRaw(val)]),
    );
  }
  return value;
}

function pretty(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    try {
      return JSON.stringify(stripRaw(JSON.parse(value)), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(stripRaw(value), null, 2);
}

function slug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "payload";
}

function JsonAccordion({
  label,
  value,
  defaultOpen,
}: {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}) {
  const content = pretty(value);
  const [open, setOpen] = useState(Boolean(defaultOpen));
  if (!content) return null;

  const download = () => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(label)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <div className="relative border-t border-border/60 bg-muted/40">
          <pre className="num max-h-80 overflow-auto overscroll-contain p-3 pr-14 text-[12px] leading-relaxed">
            {content}
          </pre>
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            <button
              type="button"
              aria-label={`Download ${label}`}
              title={`Download ${label}`}
              onClick={download}
              className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Copy ${label}`}
              title={`Copy ${label}`}
              onClick={() => void navigator.clipboard?.writeText(content)}
              className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepPanel({ row, showTitle }: { row: Dict; showTitle: boolean }) {
  const passed = scenarioPassed(row);
  const code = text(row, ["status_code", "http_status", "code", "response_status"]);
  const message = text(row, ["message", "error", "detail", "reason"]);

  return (
    <div className="grid gap-2">
      {showTitle ? (
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={1.75} />
          ) : (
            <XCircle className="size-4 shrink-0 text-destructive" strokeWidth={1.75} />
          )}
          <span className="truncate text-sm font-medium">{scenarioName(row, 0)}</span>
          <span className="text-sm text-muted-foreground">
            {passed ? "Success" : "Fail"}
            {code ? `: ${code}` : ""}
          </span>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <JsonAccordion
        label="Request"
        defaultOpen
        value={pick(row, ["request_payload", "request", "payload", "request_body"])}
      />
      <JsonAccordion
        label="Actual Response"
        defaultOpen
        value={pick(row, ["actual_response", "actual", "response", "response_body", "received"])}
      />
      {passed ? null : (
        <JsonAccordion
          label="Expected Response"
          value={pick(row, ["expected_response", "expected", "expected_body"])}
        />
      )}
    </div>
  );
}

function childSteps(row: Dict): Dict[] {
  const raw = pick(row, ["steps", "results", "checks", "cases", "details"]);
  if (Array.isArray(raw)) return raw.filter((item) => item && typeof item === "object") as Dict[];
  return [];
}

export function ScenarioResults({
  rows,
  isLoading,
  error,
}: {
  rows: Dict[];
  isLoading?: boolean;
  error?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    setActiveIndex(null);
  }, [rows.length]);

  const active = activeIndex === null ? undefined : rows[activeIndex];
  const nestedSteps = useMemo(() => {
    if (!active) return [];
    return childSteps(active);
  }, [active]);
  const steps = nestedSteps.length > 0 ? nestedSteps : active ? [active] : [];
  const hasNestedSteps = nestedSteps.length > 0;

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading scenario results…</p>;
  if (error)
    return (
      <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">This run has no scenario results yet.</p>;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted/50 px-3 py-2.5">
          <span className="label-eyebrow">Type</span>
          <span className="label-eyebrow">Status</span>
        </div>
        <ul className="max-h-[32rem] overflow-auto">
          {rows.map((row, index) => {
            const passed = scenarioPassed(row);
            return (
              <li key={index}>
                <button
                  type="button"
                  aria-expanded={index === activeIndex}
                  onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
                  className={cn(
                    "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
                    index === activeIndex ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <span className="truncate text-sm">
                    {index}. {scenarioName(row, index)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                      passed
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {passed ? "Success" : "Fail"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="min-w-0 rounded-lg border border-border p-4">
        {active && activeIndex !== null ? (
          <>
            <h3 className="font-display text-sm font-semibold">
              Test Results for “{scenarioName(active, activeIndex)}”
            </h3>
            {hasNestedSteps && text(active, ["message", "summary", "error", "detail"]) ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {text(active, ["message", "summary", "error", "detail"])}
              </p>
            ) : null}
            <div className="mt-3 grid gap-3">
              {steps.map((step, index) => (
                <StepPanel key={index} row={step} showTitle={steps.length > 1} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a scenario on the left to view its request and response. Click it again to close.
          </p>
        )}
      </div>
    </div>
  );
}
