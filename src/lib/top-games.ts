/**
 * "Top games" group for the Add operator game dialog.
 *
 * Configured in `.env`:
 * - VITE_TOP_GAME_IDS: comma-separated game ids (preferred).
 * - VITE_TOP_GAME_NAMES: comma-separated game names, matched against the
 *   catalogue when ids are not configured.
 */

export const TOP_GAMES_VALUE = "__top_games__";
export const TOP_GAMES_LABEL = "Top games";

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const env = import.meta.env as Record<string, string | undefined>;

export const TOP_GAME_IDS = parseList(env.VITE_TOP_GAME_IDS);
export const TOP_GAME_NAMES = parseList(env.VITE_TOP_GAME_NAMES);

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Row = Record<string, unknown>;

/** Resolve the configured top games to catalogue game ids. */
export function resolveTopGameIds(catalogueRows: Row[]): string[] {
  const ids = new Set<string>(TOP_GAME_IDS);

  if (TOP_GAME_NAMES.length > 0) {
    const wanted = new Set(TOP_GAME_NAMES.map(normalize));
    for (const row of catalogueRows) {
      const id = row.id ?? row.game_id;
      if (id === undefined || id === null) continue;
      const names = [row.name, row.game_name, row.master_game_name, row.partner_game_name]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(normalize);
      if (names.some((name) => wanted.has(name))) ids.add(String(id));
    }
  }

  return Array.from(ids);
}
