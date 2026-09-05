/**
 * Canonical status code → human label maps shared by tables and detail views.
 */
export type StatusTone = "positive" | "negative" | "warning" | "neutral";

type Entry = { label: string; tone: StatusTone };

const SLIP_STATUS: Record<string, Entry> = {
  "1": { label: "Pending", tone: "warning" },
  "2": { label: "Won", tone: "positive" },
  "3": { label: "No result", tone: "neutral" },
  "4": { label: "Voided", tone: "neutral" },
  "5": { label: "Lost", tone: "negative" },
};

export const BET_STATUS: Record<string, Entry> = {
  "1": { label: "Pending", tone: "warning" },
  "2": { label: "Won", tone: "positive" },
  "3": { label: "Lost", tone: "negative" },
  "7": { label: "Voided", tone: "neutral" },
};

const IS_POSTED: Record<string, Entry> = {
  "1": { label: "Pending", tone: "warning" },
  "2": { label: "Success", tone: "positive" },
  "3": { label: "Failed", tone: "negative" },
  "4": { label: "In progress", tone: "warning" },
  "5": { label: "Failed completely", tone: "negative" },
  "10": { label: "Queued", tone: "warning" },
};

const FREEBET_STATUS: Record<string, Entry> = {
  "1": { label: "Active", tone: "positive" },
  "2": { label: "Revoked", tone: "negative" },
  "3": { label: "Inactive", tone: "neutral" },
  "4": { label: "Expired", tone: "warning" },
};

const URL_TYPE: Record<string, Entry> = {
  "1": { label: "Redirect to Top Up URL", tone: "neutral" },
  "2": { label: "Send a window postMessage", tone: "neutral" },
};

function mapFor(key: string): Record<string, Entry> | null {
  const k = key.toLowerCase();
  if (k === "url_type" || k === "urltype" || k.endsWith("_url_type")) return URL_TYPE;
  if (k === "is_posted" || k === "isposted" || k.endsWith("_is_posted")) return IS_POSTED;
  if (k.includes("freebet") && k.includes("status")) return FREEBET_STATUS;
  if (k.includes("slip") && k.includes("status")) return SLIP_STATUS;
  if (k.includes("bet") && k.includes("status")) return BET_STATUS;
  return null;
}


/** Returns a friendly label + tone for known status columns, or null. */
export function statusMeta(
  key: string,
  value: unknown,
  context?: string,
): Entry | null {
  const map = mapFor(key) ?? (key.toLowerCase() === "status" && context ? mapFor(`${context}_status`) : null);
  if (!map) return null;
  if (value === null || value === undefined || value === "") return null;
  return map[String(value)] ?? null;
}
