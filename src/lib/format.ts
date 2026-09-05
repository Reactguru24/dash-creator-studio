import type { Dict } from "./api";

/**
 * True for flat objects that map a currency code to an amount, e.g. { KES: 2000, USD: 20 }.
 */
export function isAmountMap(value: unknown): value is Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(
    ([key, val]) =>
      /^[A-Za-z]{3,5}$/.test(key) &&
      (typeof val === "number" ||
        (typeof val === "string" && val.trim() !== "" && !Number.isNaN(Number(val)))),
  );
}

/** "KES 2,000 · USD 20" */
export function formatAmountMap(value: Record<string, string | number>): string {
  return Object.entries(value)
    .map(([code, amount]) => `${code.toUpperCase()} ${formatNumberValue(Number(amount))}`)
    .join(" · ");
}

/** Currency codes used by any amount-map field on a row. */
export function currencyCodesFromRow(row: Dict): string[] {
  const codes = new Set<string>();
  for (const value of Object.values(row)) {
    if (isAmountMap(value)) {
      for (const code of Object.keys(value)) codes.add(code.toUpperCase());
    }
  }
  return Array.from(codes).sort();
}

export function isIdKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized === "id" || normalized.endsWith("_id") || normalized.endsWith("id");
}

function looksLikeNumericId(value: string | number): boolean {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value === 0) return false;
    return Math.abs(value) >= 1_000;
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return false;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric === 0) return false;
  return Math.abs(numeric) >= 1_000;
}

export function formatCellValue(value: unknown, options: { useGrouping?: boolean } = {}): string {
  const isIdLike = typeof value === "number" || typeof value === "string"
    ? looksLikeNumericId(value)
    : false;
  const useGrouping = options.useGrouping ?? !isIdLike;
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return formatNumberValue(value, useGrouping);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "—";
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return formatNumberValue(numeric, useGrouping);
    }
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    // Lists of plain values read better inline than as "3 items".
    if (value.every((item) => !item || typeof item !== "object")) {
      return value.map((item) => formatCellValue(item, options)).join(" · ");
    }
    return `${value.length} items`;
  }
  if (isAmountMap(value)) return formatAmountMap(value);
  if (typeof value === "object") return summarizeObject(value as Record<string, unknown>);
  return String(value);
}

/** "Total stake 1,041.72 · Players 18" — a readable one-liner for nested cells. */
function summarizeObject(value: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (child === null || child === undefined || child === "") continue;
    if (child && typeof child === "object" && !isAmountMap(child)) continue;
    parts.push(`${humanizeKey(key)} ${formatCellValue(child)}`);
    if (parts.length === 3) break;
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}


export function formatNumberValue(value: number, useGrouping = true): string {
  if (Number.isInteger(value)) {
    return useGrouping ? value.toLocaleString("en-GB") : String(value);
  }
  if (useGrouping) {
    return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toFixed(2);
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(0)}K`;
  return formatNumberValue(value);
}

/**
 * Stat card formatting: full numbers below 100,000, compact K/M at or above it.
 * e.g. 45,231 → "45,231"; 105,000 → "105K"; 2,400,000 → "2.40M".
 */
export function formatStatValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `${Math.round(value / 1000)}K`;
  return formatNumberValue(value);
}

const COLUMN_LABELS: Record<string, string> = {
  last_balance_update: "Last update",
};

export function humanizeKey(key: string): string {
  const custom = COLUMN_LABELS[key.toLowerCase()];
  if (custom) return custom;
  return key
    .replace(/_/g, " ")
    .replace(/\buuid\b/i, "UUID")
    .replace(/\bid\b/i, "ID")
    .replace(/\bggr\b/i, "GGR")
    .replace(/^./, (c) => c.toUpperCase());
}

const PREFERRED_FIRST = ["id", "uuid", "name", "title", "reference"];

/**
 * Configured column names the API may expose under a different key.
 * The first alias actually present in the response wins.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  odds: ["odds", "total_odd", "odd", "total_odds", "bet_odds", "totalOdds"],
  stake: ["stake", "bet_amount", "stake_amount", "amount", "stakeAmount"],
  amount: ["amount_usd", "amount", "bet_amount"],
  won_amount: ["settlement_amount", "won_amount", "win_amount", "winning_amount", "winnings", "payout", "wonAmount"],

  created_at: ["created_at", "createdAt", "created", "placed_at", "date", "created_date", "date_created"],
  updated_at: ["updated_at", "updatedAt", "modified_at", "settled_at", "date_updated"],
  start_date: ["start_date", "startDate", "starts_at", "start_at", "valid_from", "date_from", "start_time"],
  end_date: ["end_date", "endDate", "ends_at", "end_at", "expires_at", "valid_to", "date_to", "end_time"],
};


export function deriveColumns(
  rows: Dict[],
  preferred?: string[],
  limit = 9,
  exclude?: string[],
): string[] {
  const keys: string[] = [];
  for (const row of rows.slice(0, 12)) {
    for (const key of Object.keys(row))
      if (!keys.includes(key) && !exclude?.includes(key)) keys.push(key);
  }
  if (preferred?.length) {
    // Explicit config wins: never let extra response keys push configured
    // columns (e.g. the date columns) past the display limit.
    const ordered: string[] = [];
    for (const key of preferred) {
      const candidates = COLUMN_ALIASES[key] ?? [key];
      const match = candidates.find((c) => keys.includes(c) && !ordered.includes(c));
      if (match) ordered.push(match);
    }
    const rest = keys.filter((key) => !ordered.includes(key));
    return [...ordered, ...rest].slice(0, Math.max(limit, ordered.length));
  }

  const scalarFirst = keys.filter((key) => PREFERRED_FIRST.some((p) => key.toLowerCase().includes(p)));
  const rest = keys.filter((key) => !scalarFirst.includes(key));
  return [...scalarFirst, ...rest].slice(0, limit);
}

export function looksLikeStatus(key: string): boolean {
  return /status|state|is_|active|posted|enabled/i.test(key);
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Strip API endpoint references (e.g. "GET /api/v1/bets — ") from user-facing copy. */
export function stripEndpoint(text?: string | null): string {
  if (!text) return "";
  let out = text;
  const dash = out.indexOf("\u2014");
  if (dash !== -1 && out.slice(0, dash).includes("/api/")) out = out.slice(dash + 1);
  out = out.replace(/(GET|POST|PUT|PATCH|DELETE)?\s*\/api\/\S+/gi, "");
  out = out.replace(/\s{2,}/g, " ").replace(/^[\s\u00b7\u2014-]+/, "").replace(/[\s\u00b7]+$/, "");
  return out.trim();
}
