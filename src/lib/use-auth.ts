import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, findObject, tokenStore, type Dict } from "./api";
import { useActiveClientStore } from "./stores/client-store";

export type AuthState = {
  token: string | null;
  user: Dict | null;
  ready: boolean;
};

export function useAuth(): AuthState & { logout: () => void; refreshMe: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({ token: null, user: null, ready: false });

  const sync = useCallback(() => {
    setState({ token: tokenStore.access, user: tokenStore.user, ready: true });
  }, []);

  useEffect(() => {
    sync();
    const handler = () => sync();
    window.addEventListener("bk-auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("bk-auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, [sync]);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.access) return;
    try {
      const payload = await apiRequest("/api/v1/auth/me");
      const user = findObject(payload, ["user", "data", "profile"]) ?? (payload as Dict);
      // /auth/me does not echo the login-time `clients` list — keep the cached one.
      const cached = tokenStore.user;
      const clients = Array.isArray(user.clients) ? user.clients : cached?.clients;
      tokenStore.setUser(clients ? { ...user, clients } : user);
    } catch {
      /* leave cached user in place */
    }
  }, []);

  const logout = useCallback(() => {
    void apiRequest("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    tokenStore.clear();
  }, []);

  return { ...state, logout, refreshMe };
}

export function userLabel(user: Dict | null): string {
  if (!user) return "Signed in";
  const first = typeof user.first_name === "string" ? user.first_name : "";
  const last = typeof user.last_name === "string" ? user.last_name : "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  for (const key of ["name", "full_name", "username", "email"]) {
    const value = user[key];
    if (typeof value === "string" && value) return value;
  }
  return "Signed in";
}

export function userRole(user: Dict | null): string | null {
  if (!user) return null;
  const role = user.role ?? user.role_name ?? user.user_type;
  if (typeof role === "string") return role;
  if (role && typeof role === "object") {
    const named = (role as Dict).name ?? (role as Dict).slug;
    if (typeof named === "string") return named;
  }
  return null;
}

const SUPER_ROLES = new Set(["admin", "super_admin", "superadmin", "root", "owner", "super-admin"]);

export function isSuperAdmin(user: Dict | null): boolean {
  const role = userRole(user)?.toLowerCase() ?? "";
  return SUPER_ROLES.has(role);
}

/** Raw account type from the API (`ADMIN`, `CLIENT_ADMIN`, …). */
export function userType(user: Dict | null): string | null {
  if (!user) return null;
  const raw = user.user_type ?? user.type ?? user.role_name ?? user.role;
  if (typeof raw === "string") return raw.toUpperCase();
  if (raw && typeof raw === "object") {
    const named = (raw as Dict).name ?? (raw as Dict).slug;
    if (typeof named === "string") return named.toUpperCase();
  }
  return null;
}

export function isClientAdmin(user: Dict | null): boolean {
  const type = userType(user);
  return type === "CLIENT_ADMIN" || type === "CLIENT-ADMIN" || type === "CLIENTADMIN";
}

function pushId(list: number[], value: unknown) {
  const num = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isNaN(num) && num > 0 && !list.includes(num)) list.push(num);
}

/** Operator/client ids this account is allowed to act on. */
export function userClientIds(user: Dict | null): number[] {
  if (!user) return [];
  const ids: number[] = [];
  const collections = [user.clients, user.operators, user.client_ids, user.operator_ids, user.assigned_clients];
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (entry && typeof entry === "object") {
        const dict = entry as Dict;
        pushId(ids, dict.operator_id ?? dict.client_id ?? dict.id);
      } else {
        pushId(ids, entry);
      }
    }
  }
  pushId(ids, user.operator_id);
  pushId(ids, user.client_id);
  return ids;
}

export type ClientScope = {
  /** True when the signed-in account is a CLIENT_ADMIN. */
  clientAdmin: boolean;
  ids: number[];
  /** `single` resolves operator from session, `multi` must send operator_id. */
  mode: "none" | "single" | "multi";
  /** The only operator id when single-client, otherwise null. */
  operatorId: string | null;
};

export function clientScope(user: Dict | null): ClientScope {
  const clientAdmin = isClientAdmin(user);
  const ids = clientAdmin ? userClientIds(user) : [];
  // An empty `clients` array means the API resolves the single client from the session.
  const mode: ClientScope["mode"] = !clientAdmin ? "none" : ids.length > 1 ? "multi" : "single";
  return { clientAdmin, ids, mode, operatorId: ids.length === 1 ? String(ids[0]) : null };
}

export type ClientOption = { id: string; name: string };

/** Clients attached to the signed-in account, as stored by the login response. */
export function userClients(user: Dict | null): ClientOption[] {
  if (!user) return [];
  const out: ClientOption[] = [];
  const collections = [user.clients, user.operators, user.assigned_clients];
  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (entry && typeof entry === "object") {
        const dict = entry as Dict;
        const rawId = dict.operator_id ?? dict.client_id ?? dict.id;
        const id = rawId === undefined || rawId === null ? "" : String(rawId);
        if (!id || out.some((c) => c.id === id)) continue;
        const name =
          [dict.name, dict.client_name, dict.operator_name, dict.title].find(
            (v) => typeof v === "string" && v,
          ) ?? `Client #${id}`;
        out.push({ id, name: String(name) });
      } else if (entry !== undefined && entry !== null && String(entry)) {
        const id = String(entry);
        if (!out.some((c) => c.id === id)) out.push({ id, name: `Client #${id}` });
      }
    }
  }
  return out;
}

export type GlobalClientScope = ClientScope & {
  /** Selectable clients for the global switcher (only when there is more than one). */
  clients: ClientOption[];
  /** True when the account is tied to exactly one client — the API resolves it from the session. */
  singleClient: boolean;
  activeClientId: string | null;
  setActiveClientId: (value: string) => void;
};


/**
 * Client scope that honours the globally selected client. Multi-client admins
 * behave like single-client admins scoped to whichever client is active, so
 * every page/query is filtered by that operator.
 */
export function useClientScope(user: Dict | null): GlobalClientScope {
  const activeClientId = useActiveClientStore((s) => s.activeClientId);
  const setActive = useActiveClientStore((s) => s.setActiveClientId);

  const base = useMemo(() => clientScope(user), [user]);
  // Derived straight from the login response cached in local storage, so the
  // switcher shows up even when the account's role string is unexpected.
  const clients = useMemo(() => userClients(user), [user]);

  const multi = clients.length > 1;
  const resolved: string | null = multi
    ? (clients.some((c) => c.id === activeClientId) ? activeClientId : clients[0]?.id ?? null)
    : base.operatorId ?? (clients.length === 1 ? clients[0]?.id ?? null : null);

  useEffect(() => {
    const next = multi ? resolved ?? null : null;
    // Compare against the live store value so concurrent hook instances don't
    // ping-pong updates and trigger "Maximum update depth exceeded".
    const current = useActiveClientStore.getState().activeClientId ?? null;
    if (current !== next) setActive(next);
  }, [multi, resolved, setActive]);


  return {
    ...base,
    clientAdmin: base.clientAdmin || clients.length > 0,
    ids: base.ids.length ? base.ids : clients.map((c) => Number(c.id)),
    mode: resolved ? "single" : base.mode,
    operatorId: resolved,
    clients: multi ? clients : [],
    singleClient: !multi && (base.clientAdmin || clients.length === 1),
    activeClientId: resolved,
    setActiveClientId: setActive,
  };
}


/**
 * Strict account-type gate for endpoints the API restricts to a role
 * (e.g. `POST /clients/{id}/regenerate-api-key` is CLIENT_ADMIN only).
 */
export function roleAllowed(user: Dict | null, roles?: string[] | null): boolean {
  if (!roles || roles.length === 0) return true;
  const type = userType(user);
  if (!type) return false;
  return roles.some((role) => role.toUpperCase() === type);
}

function extractPermissionNames(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      if (typeof v === "string") return [v];
      if (v && typeof v === "object") {
        const d = v as Dict;
        const name = d.name ?? d.slug ?? d.permission ?? d.code;
        return typeof name === "string" ? [name] : [];
      }
      return [];
    });
  }
  return [];
}

export function userPermissions(user: Dict | null): string[] {
  if (!user) return [];
  const list: string[] = [];
  list.push(...extractPermissionNames(user.permissions));
  const role = user.role;
  if (role && typeof role === "object") {
    list.push(...extractPermissionNames((role as Dict).permissions));
  }
  list.push(...extractPermissionNames(user.roles));
  return Array.from(new Set(list.map((s) => s.toLowerCase())));
}

/**
 * Check whether the current user is allowed to view something protected by
 * `permission`. Super-admins and users without any permission metadata are
 * allowed by default (the backend remains the source of truth).
 */
export function canAccess(user: Dict | null, permission?: string | string[] | null): boolean {
  if (!permission) return true;
  if (isSuperAdmin(user)) return true;
  const perms = userPermissions(user);
  if (perms.length === 0) return true;
  const need = (Array.isArray(permission) ? permission : [permission]).map((p) => p.toLowerCase());
  return need.some((p) => perms.includes(p));
}
