/**
 * "Top games" groups for the Add operator game dialog.
 *
 * Configured in `.env`:
 * - VITE_TOP_GAME_IDS: game ids. Accepts `9,5` or `[9,5]` or grouped
 *   `[[9,5],[3,11]]` — each inner array becomes its own selectable group.
 * - VITE_TOP_GAME_NAMES: comma-separated game names, matched against the
 *   catalogue when ids are not configured.
 */

import { parseIdGroups, parseIdList } from "@/lib/env-list";
import { pickEnvPairRaw } from "@/lib/env";

export const TOP_GAMES_VALUE = "__top_games__";
export const TOP_GAMES_LABEL = "Top games";

const env = import.meta.env as Record<string, string | undefined>;
const topGameIdsEnv = pickEnvPairRaw("VITE_TOP_GAME_IDS") ?? env.VITE_TOP_GAME_IDS;

export const TOP_GAME_GROUPS = parseIdGroups(topGameIdsEnv);
export const TOP_GAME_IDS = parseIdList(topGameIdsEnv);
export const TOP_GAME_NAMES = parseIdList(env.VITE_TOP_GAME_NAMES);

/** Selectable option values for each configured group (`__top_games__:0`, …). */
export function topGroupValue(index: number): string {
  return `${TOP_GAMES_VALUE}:${index}`;
}

export function isTopGroupValue(value: string): boolean {
  return value === TOP_GAMES_VALUE || value.startsWith(`${TOP_GAMES_VALUE}:`);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type Row = Record<string, unknown>;

/**
 * Resolve configured top games to catalogue game ids.
 * Pass one or more selected group values to limit the result to those groups.
 */
export function resolveTopGameIds(catalogueRows: Row[], selected?: string[]): string[] {
  const groupIds = new Set<string>();
  if (selected && selected.length > 0 && !selected.includes(TOP_GAMES_VALUE)) {
    for (const value of selected) {
      const index = Number(value.split(":")[1]);
      if (!Number.isNaN(index) && TOP_GAME_GROUPS[index]) {
        for (const id of TOP_GAME_GROUPS[index]) groupIds.add(id);
      }
    }
  } else {
    for (const id of TOP_GAME_IDS) groupIds.add(id);
  }

  if (TOP_GAME_NAMES.length > 0) {
    const wanted = new Set(TOP_GAME_NAMES.map(normalize));
    for (const row of catalogueRows) {
      const id = row.id ?? row.game_id;
      if (id === undefined || id === null) continue;
      const names = [row.name, row.game_name, row.master_game_name, row.partner_game_name]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(normalize);
      if (names.some((name) => wanted.has(name))) groupIds.add(String(id));
    }
  }

  return Array.from(groupIds);
}
