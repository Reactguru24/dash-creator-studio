import { create } from "zustand";
import { apiRequest, normalizeList, metaNumber, tokenStore, type Dict } from "@/lib/api";

export type Option = { value: string; label: string };

export type Kind = "operator" | "game" | "catalogGame" | "permission" | "role" | "partner";

type ListState = {
  options: Option[];
  rows: Dict[];
  total: number | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  promise: Promise<void> | null;
};

const emptyList = (): ListState => ({
  options: [],
  rows: [],
  total: null,
  loading: false,
  error: null,
  loaded: false,
  promise: null,
});

function toOptions(rows: Dict[], labelKeys: string[], kind: Kind): Option[] {
  return rows
    .map((row) => {
      const id = row.id ?? row.operator_id ?? row.game_id ?? row.permission_id ?? row.role_id;
      if (id === undefined || id === null) return null;
      const baseLabel = labelKeys
        .map((key) => row[key])
        .find((value) => typeof value === "string" && value);
      let label = baseLabel ? String(baseLabel) : `#${id}`;

      if (kind === "partner") {
        const count =
          typeof row.total_games === "number"
            ? row.total_games
            : typeof row.games_count === "number"
            ? row.games_count
            : typeof row.partner_games_count === "number"
            ? row.partner_games_count
            : typeof row.game_count === "number"
            ? row.game_count
            : typeof row.total_games === "string" && /^\d+$/.test(row.total_games)
            ? Number(row.total_games)
            : typeof row.games_count === "string" && /^\d+$/.test(row.games_count)
            ? Number(row.games_count)
            : typeof row.partner_games_count === "string" && /^\d+$/.test(row.partner_games_count)
            ? Number(row.partner_games_count)
            : typeof row.game_count === "string" && /^\d+$/.test(row.game_count)
            ? Number(row.game_count)
            : undefined;
        if (typeof count === "number") {
          label = `${label} (${count} game${count === 1 ? "" : "s"})`;
        }
      }

      return { value: String(id), label };
    })
    .filter((option): option is Option => option !== null)
    .sort((a, b) => a.label.localeCompare(b.label));
}

const CONFIG: Record<
  Kind,
  { path: string; perPage: number; labels: string[] }
> = {
  operator: { path: "/api/v1/clients", perPage: 200, labels: ["name", "client_name", "email"] },
  game: { path: "/api/v1/operator-games", perPage: 100000, labels: ["game_name", "name"] },
  permission: { path: "/api/v1/permissions", perPage: 500, labels: ["name", "slug"] },
  role: { path: "/api/v1/roles", perPage: 200, labels: ["name", "role_name", "slug"] },
  partner: { path: "/api/v1/partners", perPage: 200, labels: ["name", "partner_name"] },
  catalogGame: { path: "/api/v1/games", perPage: 100000, labels: ["name", "game_name", "master_game_name"] },
};

type ReferenceStore = {
  operator: ListState;
  game: ListState;
  catalogGame: ListState;
  permission: ListState;
  role: ListState;
  partner: ListState;
  gameScope: string | null;
  ensure: (kind: Kind) => Promise<void>;
  refresh: (kind: Kind, searchText?: string) => Promise<void>;
  ensureGamesForOperator: (operatorId: string) => Promise<void>;
  refreshGamesForOperator: (operatorId: string, searchText?: string) => Promise<void>;
};

export const useReferenceStore = create<ReferenceStore>((set, get) => {
  const load = async (kind: Kind, searchText?: string) => {
    // Reference lists are bearer-protected: skip silently when signed out so
    // the login screen never shows "Missing bearer token" warnings.
    if (!tokenStore.access) return;
    const cfg = CONFIG[kind];
    const trimmed = searchText?.trim() ?? "";
    const query = { page: 1, per_page: cfg.perPage } as Record<string, string | number>;
    if (trimmed) query.search = trimmed;

    set((state) => ({ [kind]: { ...state[kind], loading: true, error: null } }) as Partial<ReferenceStore>);
    try {
      // Games have two sources: operator-scoped `/api/v1/operator-games` and
      // the global catalogue `/api/v1/games`. When loading the generic
      // reference list (no operator selected) use the global endpoint with
      // a very large `per_page` so users can search across all games.
      let payload;
      if (kind === "game") {
        payload = await apiRequest("/api/v1/games", { query: { ...query, page: 1, per_page: 1000000 } });
      } else {
        payload = await apiRequest(cfg.path, { query });
      }
      const normalized = normalizeList(payload);
      const rows = normalized.rows;
      const total = metaNumber(normalized.meta, ["total", "total_items", "count", "total_records"]);
      const options = toOptions(rows, kind === "game" ? CONFIG.catalogGame.labels : cfg.labels, kind);
      set(() => ({
        [kind]: { options, rows, total, loading: false, error: null, loaded: true, promise: null },
        ...(kind === "game" ? { gameScope: null } : {}),
      }) as Partial<ReferenceStore>);
    } catch (error) {
      set(() => ({
        [kind]: {
          options: [],
          rows: [],
          total: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load",
          loaded: false,
          promise: null,
        },
      }) as Partial<ReferenceStore>);
    }
  };

  const gameLabel = (row: Dict, nameById: Map<string, string>) => {
    const id = row.game_id ?? row.id;
    if (id === undefined || id === null) return null;
    const nested = (row.game ?? row.games) as Record<string, unknown> | undefined;
    const candidate =
      (typeof row.master_game_name === "string" && row.master_game_name) ||
      (typeof row.game_name === "string" && row.game_name) ||
      (typeof row.name === "string" && row.name) ||
      (nested && typeof nested.name === "string" && nested.name) ||
      nameById.get(String(id)) ||
      (typeof row.partner_game_name === "string" && row.partner_game_name) ||
      (typeof row.partner_game_id === "string" && row.partner_game_id) ||
      "";
    return { value: String(id), label: candidate ? String(candidate) : `#${id}` } as Option;
  };

  // Game dropdown reads operator-scoped `/api/v1/operator-games` when an
  // operator is selected; otherwise it loads the global catalogue from
  // `/api/v1/games` (see `load` above) with a large `per_page`.
  const loadGamesForOperator = async (operatorId: string, searchText?: string) => {
    if (!tokenStore.access) return;
    const cfg = CONFIG.game;
    const trimmed = searchText?.trim() ?? "";
    const query: Record<string, string | number | undefined> = {
      page: 1,
      per_page: cfg.perPage,
      operator_id: operatorId || undefined,
    };
    if (trimmed) query.search = trimmed;

    set((state) => ({ game: { ...state.game, loading: true, error: null } }) as Partial<ReferenceStore>);
    try {
      const payload = await apiRequest(cfg.path, { query });
      const normalized = normalizeList(payload);
      const rows = normalized.rows;
      const total = metaNumber(normalized.meta, ["total", "total_items", "count", "total_records"]);

      const nameById = new Map<string, string>();
      for (const row of rows) {
        const id = row.game_id ?? row.id;
        const name = (typeof row.game_name === "string" && row.game_name) || (typeof row.name === "string" && row.name);
        if (id !== undefined && id !== null && name) nameById.set(String(id), String(name));
      }

      const options = rows
        .map((row) => gameLabel(row, nameById))
        .filter((o): o is Option => o !== null)
        .sort((a, b) => a.label.localeCompare(b.label));

      set(() => ({
        game: { options, rows, total, loading: false, error: null, loaded: true, promise: null },
        gameScope: operatorId || null,
      }) as Partial<ReferenceStore>);
    } catch (error) {
      set(() => ({
        game: {
          options: [],
          rows: [],
          total: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load",
          loaded: false,
          promise: null,
        },
        gameScope: operatorId || null,
      }) as Partial<ReferenceStore>);
      throw error;
    }
  };

  return {
    operator: emptyList(),
    game: emptyList(),
    catalogGame: emptyList(),
    permission: emptyList(),
    role: emptyList(),
    partner: emptyList(),
    gameScope: null,
    ensure: (kind) => {
      const current = get()[kind];
      if (kind === "game") {
        if (get().gameScope !== null) {
          // If a scoped list is active, load the operator-specific list.
          return loadGamesForOperator("");
        }
        if (current.loaded || current.loading) return current.promise ?? Promise.resolve();
        const promise = load("game");
        set((state) => ({ game: { ...state.game, promise } }) as Partial<ReferenceStore>);
        return promise;
      }
      if (current.loading || current.loaded) return current.promise ?? Promise.resolve();
      const promise = load(kind);
      set((state) => ({ [kind]: { ...state[kind], promise } }) as Partial<ReferenceStore>);
      return promise;
    },
    refresh: (kind, searchText) => (kind === "game" ? load("game", searchText) : load(kind, searchText)),
    ensureGamesForOperator: async (operatorId: string) => {
      if (!operatorId) return;
      const state = get();
      if (state.gameScope === operatorId && state.game.loaded) return;
      await loadGamesForOperator(operatorId);
    },
    refreshGamesForOperator: (operatorId: string, searchText?: string) => loadGamesForOperator(operatorId, searchText),
  };
});

/**
 * Parse currency codes from a client row's default_currency + currency_list.
 * Supports strings ("KES,USD"), arrays, or JSON blobs.
 */
export function currenciesFromClient(row: Dict | undefined): string[] {
  if (!row) return [];
  const set = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) set.add(v.trim().toUpperCase());
  };
  push(row.default_currency);
  const list = row.currency_list;
  if (Array.isArray(list)) list.forEach(push);
  else if (typeof list === "string") {
    const trimmed = list.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) parsed.forEach(push);
      } catch {
        /* ignore */
      }
    } else {
      trimmed.split(/[,\s]+/).forEach(push);
    }
  }
  return Array.from(set);
}

