export const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "https://api.backoffice.staging.betkraft.co.uk"
).replace(/\/$/, "");

const TOKEN_KEY = "bk_access_token";
const REFRESH_KEY = "bk_refresh_token";
const USER_KEY = "bk_user";

export type Json = unknown;
export type Dict = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  payload: Json;
  constructor(message: string, status: number, payload: Json) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export const tokenStore = {
  get access() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  get user(): Dict | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Dict;
    } catch {
      return null;
    }
  },
  set(access: string, refresh?: string | null, user?: Dict | null) {
    window.localStorage.setItem(TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("bk-auth-change"));
  },
  setTokens(access: string, refresh?: string | null) {
    window.localStorage.setItem(TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("bk-auth-change"));
  },
  setUser(user: Dict) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("bk-auth-change"));
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event("bk-auth-change"));
  },
};

export type QueryValue = string | number | boolean | undefined | null;

export function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Single in-flight refresh shared by all concurrent 401s. */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  refreshPromise ??= (async () => {
    try {
      const payload = await apiRequest<Json>("/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
        auth: false,
        allowRefresh: false,
      });
      const access = findString(payload, ["access_token", "accessToken", "token"]);
      if (!access) return false;
      const nextRefresh = findString(payload, ["refresh_token", "refreshToken"]);
      tokenStore.setTokens(access, nextRefresh ?? refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Allow a new attempt on the next 401 wave.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T = Json>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    query?: Record<string, QueryValue>;
    body?: unknown;
    auth?: boolean;
    allowRefresh?: boolean;
  } = {},
): Promise<T> {
  const { method = "GET", query, body, auth = true, allowRefresh = true } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenStore.access;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    const viteEnv = import.meta.env as { PROD?: boolean };
    const isProd = Boolean(viteEnv.PROD);
    const message = isProd
      ? "Network error — the API is temporarily unavailable."
      : /staging/i.test(API_BASE)
        ? "Network error — the API is unreachable."
        : "Network error — the API is unreachable.";
    throw new ApiError(message, 0, null);
  }

  const text = await response.text();
  let payload: Json = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  // The API answers HTTP 200 with an embedded status_code for failures too.
  const embedded = embeddedStatus(payload);
  const status = response.ok && embedded ? embedded : response.status;
  const failed = !response.ok || (embedded !== null && embedded >= 400);

  if (failed) {
    if (status === 401 && auth && typeof window !== "undefined") {
      if (allowRefresh && tokenStore.refresh) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return apiRequest<T>(path, { ...options, allowRefresh: false });
        }
      }
      tokenStore.clear();
    }
    throw new ApiError(
      extractMessage(payload) ?? "Something went wrong. Please try again.",
      status,
      payload,
    );
  }

  return payload as T;
}

function embeddedStatus(payload: Json): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Dict).status_code;
  if (typeof value === "number") return value;
  if (typeof value === "string" && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

/** Flatten a Laravel-style `errors` bag into readable "field: message" lines. */
export function fieldErrors(payload: Json): string[] {
  if (!payload || typeof payload !== "object") return [];
  const bag =
    (payload as Dict).errors ?? (payload as Dict).error_details ?? (payload as Dict).validation;
  if (!bag || typeof bag !== "object") return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(bag as Dict)) {
    const messages = Array.isArray(value) ? value : [value];
    for (const message of messages) {
      if (typeof message === "string") lines.push(`${humanField(key)}: ${message}`);
    }
  }
  return lines;
}

function humanField(key: string) {
  return key.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const dict = payload as Dict;
  for (const key of ["message", "error", "status_description", "detail"]) {
    const value = dict[key];
    if (typeof value === "string") return value;
  }
  const errors = dict.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors as Dict)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  }
  return null;
}

/** Depth-first search for the first string value stored under any of the given keys. */
export function findString(payload: Json, keys: string[], depth = 6): string | null {
  if (!payload || typeof payload !== "object" || depth < 0) return null;
  const dict = payload as Dict;
  for (const key of keys) {
    const value = dict[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  for (const value of Object.values(dict)) {
    if (value && typeof value === "object") {
      const found = findString(value, keys, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/** Depth-first search for the first object value stored under any of the given keys. */
export function findObject(payload: Json, keys: string[], depth = 5): Dict | null {
  if (!payload || typeof payload !== "object" || depth < 0) return null;
  const dict = payload as Dict;
  for (const key of keys) {
    const value = dict[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Dict;
  }
  for (const value of Object.values(dict)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const found = findObject(value, keys, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

export type ListResult = {
  rows: Dict[];
  meta: Dict | null;
  raw: Json;
};

const META_KEYS = ["meta", "pagination", "paginate", "links"];

/** The API returns collections under a few different envelopes — normalise them. */
export function normalizeList(payload: Json): ListResult {
  const paginationShape = (value: unknown): Dict | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const dict = value as Dict;
    const pageKeys = [
      "page",
      "per_page",
      "total",
      "total_pages",
      "last_page",
      "total_items",
      "count",
      "total_records",
    ];
    return Object.keys(dict).some((key) => pageKeys.includes(key)) ? dict : null;
  };

  const meta = findObject(payload, META_KEYS) ?? paginationShape(payload);

  const fromArray = (value: unknown): Dict[] | null => {
    if (!Array.isArray(value)) return null;
    return value.map((item) =>
      item && typeof item === "object" && !Array.isArray(item) ? (item as Dict) : { value: item },
    );
  };

  const direct = fromArray(payload);
  if (direct) return { rows: direct, meta, raw: payload };

  if (payload && typeof payload === "object") {
    const dict = payload as Dict;
    const candidateKeys = ["data", "items", "results", "records", "rows", "list", "collection"];
    for (const key of candidateKeys) {
      const arr = fromArray(dict[key]);
      if (arr) {
        return { rows: arr, meta: meta ?? paginationShape(dict[key]), raw: payload };
      }
    }
    for (const key of candidateKeys) {
      const nested = dict[key];
      if (nested && typeof nested === "object") {
        for (const innerKey of candidateKeys) {
          const arr = fromArray((nested as Dict)[innerKey]);
          if (arr) {
            return {
              rows: arr,
              meta: meta ?? paginationShape(nested) ?? paginationShape((nested as Dict)[innerKey]),
              raw: payload,
            };
          }
        }
      }
    }
    // Single object payloads still render as a one-row table.
    const single = dict.data;
    if (single && typeof single === "object" && !Array.isArray(single)) {
      return { rows: [single as Dict], meta, raw: payload };
    }
  }

  return { rows: [], meta, raw: payload };
}

export function metaNumber(meta: Dict | null, keys: string[]): number | null {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)))
      return Number(value);
  }
  return null;
}
