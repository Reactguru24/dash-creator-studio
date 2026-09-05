import { useQuery } from "@tanstack/react-query";
import { apiRequest, normalizeList, type Dict } from "@/lib/api";

/**
 * Shared data layer for the `/api/v1/stats/*` family documented in the
 * backoffice swagger:
 *  - GET /api/v1/stats/summary  (totals, optionally grouped)
 *  - GET /api/v1/stats/top      (top N by type + metric)
 *  - GET /api/v1/stats/activity (DAU / MAU / stickiness)
 *
 * Responses vary in shape (flat, nested under `data`, or nested per currency),
 * so every read goes through the tolerant helpers below.
 */

export type StatsMetricKey =
  | "ggr"
  | "total_bets"
  | "total_stake"
  | "players"
  | "total_won"
  | "free_bet_won";

export type TopType = "clients" | "games" | "operator-games" | "partners" | "days" | "months";

export type GroupBy = "game" | "operator" | "partner" | "operator_game";

/** Reference/summary data changes slowly — cache it for five minutes. */
const STALE_TIME = 5 * 60_000;

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

const PREFERRED_KEYS = ["totals", "usd", "total", "summary", "values", "data", "stats"];

/** Depth-first search for a metric key, preferring `totals`/currency wrappers. */
export function metricOf(node: unknown, key: string, depth = 5): number | null {
  if (!node || typeof node !== "object" || depth < 0) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = metricOf(item, key, depth - 1);
      if (found !== null) return found;
    }
    return null;
  }
  const dict = node as Dict;
  const direct = toNumber(dict[key]);
  if (direct !== null) return direct;
  for (const preferred of PREFERRED_KEYS) {
    if (preferred in dict) {
      const found = metricOf(dict[preferred], key, depth - 1);
      if (found !== null) return found;
    }
  }
  for (const [entryKey, value] of Object.entries(dict)) {
    if (PREFERRED_KEYS.includes(entryKey)) continue;
    const found = metricOf(value, key, depth - 1);
    if (found !== null) return found;
  }
  return null;
}

const LABEL_KEYS = [
  "name",
  "game_name",
  "client_name",
  "operator_name",
  "partner_name",
  "label",
  "title",
  "day",
  "date",
  "month",
  "period",
];

/** Best human label for a stats row, falling back to an id. */
export function labelOf(row: Dict, max = 22): string {
  for (const key of LABEL_KEYS) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.length > max ? `${value.slice(0, max - 1)}…` : value;
    }
    if (typeof value === "number") return String(value);
  }
  const id = row["id"] ?? row["game_id"] ?? row["client_id"] ?? row["operator_id"] ?? row["partner_id"];
  return id === undefined || id === null ? "—" : `#${String(id)}`;
}

/** RTP = ((total stake − GGR) / total stake) × 100. */
export function rtpOf(totalStake: number | null, ggr: number | null): number | null {
  if (totalStake === null || ggr === null || totalStake <= 0) return null;
  return ((totalStake - ggr) / totalStake) * 100;
}

/** House margin = GGR / total stake × 100 (the mirror of RTP). */
export function marginPctOf(totalStake: number | null, ggr: number | null): number | null {
  if (totalStake === null || ggr === null || totalStake <= 0) return null;
  return (ggr / totalStake) * 100;
}

export type StatsFilters = {
  dateFrom: string;
  dateTo: string;
  operatorId?: number | undefined;
  partnerId?: number | undefined;
  gameId?: number | undefined;
  /** Set false while a required filter (e.g. a client) is still missing. */
  enabled?: boolean;
};

function baseQuery(filters: StatsFilters) {
  return {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    operator_id: filters.operatorId,
    partner_id: filters.partnerId,
    game_id: filters.gameId,
  };
}

function keyOf(filters: StatsFilters) {
  return [
    filters.dateFrom,
    filters.dateTo,
    filters.operatorId ?? null,
    filters.partnerId ?? null,
    filters.gameId ?? null,
  ];
}

/** GET /api/v1/stats/summary — totals for the range, optionally grouped. */
export function useStatsSummary(filters: StatsFilters, groupBy?: GroupBy) {
  return useQuery({
    queryKey: ["stats-summary", ...keyOf(filters), groupBy ?? null],
    retry: false,
    staleTime: STALE_TIME,
    enabled: filters.enabled !== false && Boolean(filters.dateFrom && filters.dateTo),
    queryFn: () =>
      apiRequest("/api/v1/stats/summary", {
        query: { ...baseQuery(filters), group_by: groupBy },
      }),
  });
}

/** GET /api/v1/stats/top — top N entities for a metric. */
export function useStatsTop(
  type: TopType,
  metric: StatsMetricKey,
  filters: StatsFilters,
  limit = 10,
) {
  return useQuery({
    queryKey: ["stats-top", type, metric, limit, ...keyOf(filters)],
    retry: false,
    staleTime: STALE_TIME,
    enabled: filters.enabled !== false && Boolean(filters.dateFrom && filters.dateTo),
    queryFn: () =>
      apiRequest("/api/v1/stats/top", {
        query: { ...baseQuery(filters), type, metric, limit },
      }),
  });
}

/** GET /api/v1/stats/activity — DAU, MAU and stickiness across the range. */
export function useStatsActivity(filters: StatsFilters) {
  return useQuery({
    queryKey: ["stats-activity", ...keyOf(filters)],
    retry: false,
    staleTime: STALE_TIME,
    enabled: filters.enabled !== false && Boolean(filters.dateFrom && filters.dateTo),
    queryFn: () =>
      apiRequest("/api/v1/stats/activity", { query: baseQuery(filters) }),
  });
}

export type SeriesPoint = { label: string; value: number; row: Dict };

/** Turn any stats payload into `{ label, value }` points for recharts. */
export function seriesFrom(payload: unknown, metric: string): SeriesPoint[] {
  const rows = normalizeList((payload ?? null) as Dict | null).rows;
  return rows.map((row) => ({
    label: labelOf(row),
    value: metricOf(row, metric, 3) ?? 0,
    row,
  }));
}

/** Rows of a grouped summary / top response, untouched. */
export function rowsFrom(payload: unknown): Dict[] {
  return normalizeList((payload ?? null) as Dict | null).rows;
}

export function errorMessage(error: unknown): string | null {
  return error ? (error as Error).message : null;
}
