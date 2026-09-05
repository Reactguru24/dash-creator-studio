import { useQuery } from "@tanstack/react-query";
import { Download, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, normalizeList, type Dict, type QueryValue } from "@/lib/api";
import type { ResourceDef } from "@/lib/endpoints";
import { useAuth, useClientScope } from "@/lib/use-auth";
import { formatCellValue, humanizeKey } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { FilterBar } from "./filter-bar";
import { useReferenceOptions } from "./reference-select";
import { ApiErrorBox } from "./api-error";
import { StatCard } from "./stat-card";
import { Skeleton } from "@/components/ui/skeleton";

function initialValues(resource: ResourceDef): Record<string, QueryValue> {
  const values: Record<string, QueryValue> = {};
  for (const filter of resource.filters ?? []) values[filter.name] = "";
  return { ...values, ...(resource.defaults ?? {}) };
}

function flatten(row: Dict): [string, unknown][] {
  return Object.entries(row).filter(
    ([key, value]) => !HIDDEN_KEYS.has(key) && (typeof value !== "object" || value === null),
  );
}

const TITLE_KEYS = ["operator_name", "client_name", "operator", "client", "name", "game_name"];

/** Fields intentionally hidden from the invoice screen. */
const HIDDEN_KEYS = new Set([
  "operator_id",
  "partner_id",
  "line_items",
  // Free bet won is not part of the GGR basis shown here — total voided is.
  "free_bet_won",
  "freebet_won",
]);

/** Meta fields shown in the header summary line instead of as cards. */
function isMetaKey(key: string) {
  return /^(currency|month|period)$/i.test(key) || /invoice_bas/i.test(key);
}

function isGgrKey(key: string) {
  return /^ggr$/i.test(key);
}

function iconFor(key: string) {
  if (/amount|total|revenue|ggr|ngr|payout|win|fee|commission|invoice/i.test(key)) return "Coins";
  if (/stake|bet|wager/i.test(key)) return "Dices";
  if (/count|rounds|players|sessions|transactions/i.test(key)) return "Hash";
  if (/date|month|period|created|updated/i.test(key)) return "CalendarDays";
  if (/currency/i.test(key)) return "Banknote";
  return "TrendingUp";
}

export function InvoiceView({ resource }: { resource: ResourceDef }) {
  const [values, setValues] = useState<Record<string, QueryValue>>(() => initialValues(resource));
  const { user } = useAuth();
  const scope = useClientScope(user);
  const lockOperator = scope.mode === "single" && !!scope.operatorId;

  useEffect(() => {
    if (!lockOperator || !scope.operatorId) return;
    setValues((prev) =>
      prev.operator_id === scope.operatorId ? prev : { ...prev, operator_id: scope.operatorId },
    );
  }, [lockOperator, scope.operatorId]);

  const request = useQuery({
    queryKey: [resource.key, values],
    queryFn: () => apiRequest(resource.path, { query: values }),
    retry: false,
  });

  const rows = useMemo(() => normalizeList(request.data ?? null).rows, [request.data]);
  const month = String(values.month ?? "");
  const operatorOptions = useReferenceOptions("operator");
  const operatorName =
    operatorOptions.options.find((option) => option.value === String(values.operator_id ?? ""))
      ?.label ?? "";
  const [downloading, setDownloading] = useState(false);

  const firstRow = rows[0];
  const currency = firstRow
    ? String(
        Object.entries(firstRow).find(([key]) => /^currency$/i.test(key))?.[1] ?? "",
      )
    : "";
  const basis = firstRow
    ? String(Object.entries(firstRow).find(([key]) => /invoice_bas/i.test(key))?.[1] ?? "")
    : "";
  const rowMonth = firstRow
    ? String(Object.entries(firstRow).find(([key]) => /^(month|period)$/i.test(key))?.[1] ?? "")
    : "";
  const shownMonth = month || rowMonth;

  return (
    <div className="space-y-4">
      <FilterBar
        filters={resource.filters ?? []}
        locked={lockOperator ? ["operator_id"] : undefined}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        busy={request.isFetching}
        onReset={() => {
          const fresh = initialValues(resource);
          if (lockOperator && scope.operatorId) fresh.operator_id = scope.operatorId;
          setValues(fresh);
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="num text-xs text-muted-foreground">
            {rows.length} invoice{rows.length === 1 ? "" : "s"}
            {shownMonth ? ` · ${shownMonth}` : ""}
            {basis ? ` · ${basis}` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0 || downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await downloadInvoicePdf(`invoice-${month || "all"}.pdf`, rows, month, operatorName);
            } finally {
              setDownloading(false);
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Download className="size-3.5" strokeWidth={2} />
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {request.error ? (
        <ApiErrorBox error={request.error} />
      ) : request.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full bg-muted/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ReceiptText className="size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-display text-sm font-semibold">No invoice data</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Pick an operator and month to generate the invoice breakdown.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row, index) => {
            const titleKey = TITLE_KEYS.filter((key) => !HIDDEN_KEYS.has(key)).find(
              (key) => row[key] !== undefined && row[key] !== null,
            );
            const title = titleKey
              ? `${humanizeKey(titleKey)}: ${formatCellValue(row[titleKey])}`
              : operatorName || `Invoice ${index + 1}`;
            const stats = flatten(row).filter(
              ([key]) => key !== titleKey && !isMetaKey(key),
            );
            const nested = Object.entries(row).filter(
              ([key, value]) => !HIDDEN_KEYS.has(key) && value && typeof value === "object",
            );
            return (
              <section key={index} className="space-y-3">
                {rows.length > 1 || titleKey ? (
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-sm font-semibold">{title}</h3>
                    {shownMonth ? <span className="label-eyebrow">{shownMonth}</span> : null}
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map(([key, value]) => (
                    <StatCard
                      key={key}
                      label={humanizeKey(key)}
                      value={formatCellValue(value) || "—"}
                      icon={iconFor(key)}
                      bold={isGgrKey(key)}
                      tone={/amount|total|ggr|ngr|revenue/i.test(key) ? "primary" : "default"}
                    />
                  ))}
                </div>
                {nested.map(([key, value]) => (
                  <div key={key} className="space-y-3">
                    <p className="label-eyebrow">{humanizeKey(key)}</p>
                    {Array.isArray(value) ? (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {value.map((item, itemIndex) => (
                          <article key={itemIndex} className="panel space-y-2 p-4">
                            <dl className="space-y-2">
                              {Object.entries(
                                (item && typeof item === "object"
                                  ? item
                                  : { value: item }) as Record<string, unknown>,
                              ).map(([itemKey, itemValue]) => (
                                <div
                                  key={itemKey}
                                  className="flex items-baseline justify-between gap-3"
                                >
                                  <dt className="label-eyebrow">{humanizeKey(itemKey)}</dt>
                                  <dd className="num break-words text-right text-sm">
                                    {itemValue && typeof itemValue === "object"
                                      ? "—"
                                      : formatCellValue(itemValue)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(value as Record<string, unknown>).map(
                          ([childKey, childValue]) => (
                            <StatCard
                              key={childKey}
                              label={humanizeKey(childKey)}
                              value={
                                childValue && typeof childValue === "object"
                                  ? "—"
                                  : formatCellValue(childValue) || "—"
                              }
                              icon={iconFor(childKey)}
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {currency && rows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Note: all amounts are shown in <span className="font-semibold">{currency}</span>.
        </p>
      ) : null}
    </div>
  );
}