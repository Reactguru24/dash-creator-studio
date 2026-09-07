/**
 * Helpers for reading list-style values out of `.env`.
 *
 * Supported shapes:
 *   FOO=1,2,3
 *   FOO=[1,2,3]
 *   FOO=[[9,5],[3,11]]   (groups)
 */

function coerceEntry(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Parse an env value into groups of ids. A flat list becomes a single group. */
export function parseIdGroups(value: unknown): string[][] {
  const normalizeGroup = (group: unknown): string[] =>
    Array.isArray(group)
      ? group.map((entry) => coerceEntry(entry)).filter((id): id is string => Boolean(id))
      : [coerceEntry(group)].filter((id): id is string => Boolean(id));

  if (Array.isArray(value)) {
    if (value.every((entry) => Array.isArray(entry))) {
      return value
        .map((group) => normalizeGroup(group))
        .filter((group) => group.length > 0);
    }
    const flat = normalizeGroup(value);
    return flat.length > 0 ? [flat] : [];
  }

  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];

  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.every((entry) => Array.isArray(entry))) {
          return (parsed as unknown[][])
            .map((group) => normalizeGroup(group))
            .filter((group) => group.length > 0);
        }
        const flat = normalizeGroup(parsed);
        return flat.length > 0 ? [flat] : [];
      }
    } catch {
      /* fall through to numeric parsing */
    }
  }

  const matches = raw.match(/\d+/g) ?? [];
  if (matches.length > 0) return [matches];

  const flat = raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return flat.length > 0 ? [flat] : [];
}

/** Parse an env value into a flat list of ids (groups are flattened). */
export function parseIdList(value: unknown): string[] {
  return Array.from(new Set(parseIdGroups(value).flat()));
}

/** Parse an env value that may hold several URLs (staging first, production second). */
export function parseUrlList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const raw = value.trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return raw.includes(",") ? raw.split(",").map((entry) => entry.trim()).filter(Boolean) : [raw];
}
