import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  apiRequest,
  extractMessage,
  fieldErrors,
  normalizeList,
  type Dict,
  type QueryValue,
} from "@/lib/api";
import { resolvePath, type ActionDef, type ActionField } from "@/lib/actions";
import { CURRENCY_OPTIONS } from "@/lib/utils/currencies";
import { cn } from "@/lib/utils";
import { stripEndpoint } from "@/lib/format";
import { TOP_GAMES_LABEL, TOP_GAMES_VALUE, resolveTopGameIds } from "@/lib/top-games";
import { ReadableValue } from "./readable-value";
import { ReferenceSelect, MultiReferenceSelect } from "./reference-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DateField } from "@/components/ui/date-field";

import { currenciesFromClient, useReferenceStore } from "@/lib/stores/reference-store";
import { JACKPOT_FIELDS, isDenominationGame, isJackpotGame } from "@/lib/game-features";
import { isClientAdmin, useAuth, userClients } from "@/lib/use-auth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FormValue = string | boolean | File | string[] | null;

/** Rows sometimes carry a differently named field than the form uses. */
const PREFILL_ALIASES: Record<string, string[]> = {
  expected_rtp: ["expected_rtp", "rtp"],
  live_url: ["live_url", "game_url", "launch_url"],
  demo_url: ["demo_url", "demo_game_url"],
  partner_game_id: ["partner_game_id", "partner_game_uuid"],
  category_id: ["category_id", "game_category_id"],
  name: ["name", "game_name", "master_game_name"],
  // operator-game rows carry their own record `id`; the game reference is `game_id`.
  game_id: ["game_id", "master_game_id"],
};

function prefillValue(name: string, row?: Dict): unknown {
  if (!row) return undefined;
  // Some records nest their configuration (e.g. client settings) one level deep.
  const nested = ["settings", "setting", "client_setting", "client_settings"]
    .map((key) => row[key])
    .filter(
      (value): value is Dict =>
        Boolean(value) && typeof value === "object" && !Array.isArray(value),
    );
  const sources: Dict[] = [row, ...nested];
  for (const key of PREFILL_ALIASES[name] ?? [name]) {
    for (const source of sources) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
}

function initialState(action: ActionDef, row?: Dict): Record<string, FormValue> {
  const state: Record<string, FormValue> = {};
  for (const field of action.fields ?? []) {
    if (field.type === "file") {
      state[field.name] = null;
      continue;
    }
    if (field.type === "boolean") {
      state[field.name] = false;
      continue;
    }
    if (
      field.type === "permissions-multi" ||
      field.type === "operators-multi" ||
      field.type === "partners-multi" ||
      field.type === "games-multi"
    ) {
      state[field.name] = [];
      continue;
    }

    const prefilled = action.prefill?.includes(field.name)
      ? prefillValue(field.name, row)
      : undefined;
    state[field.name] =
      prefilled === undefined || prefilled === null
        ? ""
        : Array.isArray(prefilled)
          ? prefilled.map((item) => String(item)).join(",")
          : typeof prefilled === "object"
            ? JSON.stringify(prefilled)
            : String(prefilled);
  }
  return state;
}

function coerce(field: ActionField, value: FormValue, operatorCurrencies: string[] = []): unknown {
  if (field.type === "boolean") return Boolean(value);
  if (field.type === "partners-multi" || field.type === "games-multi") {
    // Handled by the bulk assignment loop, never sent as a body field.
    return undefined;
  }
  if (field.type === "permissions-multi" || field.type === "operators-multi") {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    return value.map((v) => Number(v));
  }

  if (value === null || value === "") return undefined;
  if (field.type === "number") return Number.parseInt(String(value), 10);
  if (field.type === "decimal") return Number(value);
  if (
    field.type === "operator" ||
    field.type === "game" ||
    field.type === "permission" ||
    field.type === "role"
  )
    return Number(value);
  if (
    field.type === "select" &&
    /^\d+$/.test(String(value)) &&
    field.options?.some((o) => o.value === value)
  ) {
    return Number(value);
  }
  if (field.type === "color") {
    const hex = String(value ?? "").trim();
    return hex ? [hex] : undefined;
  }
  if (
    field.type === "money" ||
    field.type === "object" ||
    field.type === "object-array" ||
    field.type === "json"
  ) {
    try {
      const raw = String(value).trim();
      if (field.name === "denomination" && raw && !raw.startsWith("{")) {
        const fallback = raw
          .split(",")
          .map((segment) => segment.trim())
          .filter(Boolean)
          .map((segment) => Number(segment))
          .filter((n) => Number.isFinite(n));
        if (fallback.length > 0) {
          const currencies = operatorCurrencies.length > 0 ? operatorCurrencies : ["USD"];
          return Object.fromEntries(
            currencies.map((currency) => [currency.toUpperCase(), fallback]),
          );
        }
      }
      const parsed = JSON.parse(raw);
      if (field.type === "object-array" && !Array.isArray(parsed)) return undefined;
      if (
        (field.type === "object" || field.type === "money") &&
        (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      )
        return undefined;
      if (field.type === "money") {
        // Drop empty currency slots.
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (v === "" || v === null || v === undefined) continue;
          const n = Number(v);
          if (Number.isFinite(n)) out[k] = n;
        }
        return Object.keys(out).length === 0 ? undefined : out;
      }
      if (field.type === "object-array" && Array.isArray(parsed) && parsed.length === 0)
        return undefined;
      if (field.type === "object" && parsed && Object.keys(parsed).length === 0) return undefined;
      return parsed;
    } catch {
      throw new Error(`${field.label} must be valid JSON.`);
    }
  }
  return value;
}

function valuesEqual(a: FormValue | undefined, b: FormValue | undefined): boolean {
  if (a === b) return true;
  const emptish = (v: FormValue | undefined) => v === "" || v === null || v === undefined;
  return emptish(a) && emptish(b);
}

export function ActionDialog({
  action,
  row,
  open,
  onOpenChange,
  onSuccess,
}: {
  action: ActionDef;
  row?: Dict;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (data?: unknown) => void;
}) {
  const [values, setValues] = useState<Record<string, FormValue>>(() => initialState(action, row));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [wrapEntries, setWrapEntries] = useState<Record<string, FormValue>[]>(() => {
    if (!action.wrapAs) return [];
    const first: Record<string, FormValue> = {};
    for (const name of action.wrapAs.fields) {
      first[name] = (initialState(action, row)[name] as FormValue) ?? "";
    }
    return [first];
  });
  const [result, setResult] = useState<unknown>(null);
  const pristineRef = useRef<Record<string, FormValue> | null>(null);
  const operatorGameOptions = useReferenceStore((state) => state.game.options);
  const catalogGameOptions = useReferenceStore((state) => state.catalogGame.options);
  const gameOptions = useMemo(
    () => [...operatorGameOptions, ...catalogGameOptions],
    [operatorGameOptions, catalogGameOptions],
  );

  // Edit modal: pull the authoritative record from GET /api/v1/operator-games
  // (operator_id is required) so every field is prefilled from the API.
  const detailEnabled =
    open &&
    action.key === "operator-game-update" &&
    row?.id !== undefined &&
    row?.operator_id !== undefined &&
    row?.operator_id !== null;

  const detailQuery = useQuery({
    queryKey: ["operator-game-detail", String(row?.operator_id ?? ""), String(row?.id ?? "")],
    enabled: detailEnabled,
    queryFn: async () => {
      const payload = await apiRequest("/api/v1/operator-games", {
        query: {
          operator_id: String(row?.operator_id ?? ""),
          game_id:
            row?.game_id === undefined || row?.game_id === null ? undefined : String(row.game_id),
          page: 1,
          per_page: 100,
        },
      });
      const rows = normalizeList(payload).rows;
      return rows.find((item) => String(item.id) === String(row?.id)) ?? rows[0] ?? null;
    },
  });

  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (!open || action.key !== "user-create") return;

    void useReferenceStore.getState().refresh("operator");
    void useReferenceStore.getState().refresh("role");
    void useReferenceStore.getState().refresh("permission");
  }, [open, action.key]);

  const isUpdate = action.scope === "row" && /(update|settings)$/i.test(action.key);

  useEffect(() => {
    if (!open || !isUpdate) {
      if (!open) pristineRef.current = null;
      return;
    }
    pristineRef.current = { ...initialState(action, row) };
  }, [action, isUpdate, open, row]);

  useEffect(() => {
    if (!detail) return;
    setValues((prev) => {
      const next = { ...prev };
      // Currency editors need the operator even when the field is not rendered.
      if (detail.operator_id !== undefined && detail.operator_id !== null) {
        next.operator_id = String(detail.operator_id);
      }
      // Jackpot-style aliases: the API stores these under the limit columns.
      const aliases: Record<string, string[]> = {
        stake: ["minimum_stake"],
        payout: ["maximum_win", "maximum_stake"],
      };
      for (const field of action.fields ?? []) {
        if (field.type === "file") continue;
        let raw = detail[field.name];
        if (raw === undefined || raw === null || raw === "") {
          for (const alias of aliases[field.name] ?? []) {
            const candidate = detail[alias];
            if (candidate !== undefined && candidate !== null && candidate !== "") {
              raw = candidate;
              break;
            }
          }
        }
        // The API leaves game_name null — fall back to the master game name.
        if (field.name === "game_name" && (raw === null || raw === undefined || raw === "")) {
          raw = detail.master_game_name ?? detail.partner_game_name;
        }
        if (raw === undefined || raw === null || raw === "") continue;
        if (field.type === "boolean") {
          next[field.name] = raw === true || raw === 1 || raw === "1";
          continue;
        }
        if (field.type === "permissions-multi") continue;
        if (field.type === "color") {
          const first = Array.isArray(raw) ? raw[0] : raw;
          next[field.name] = typeof first === "string" && first ? first : "#000000";
          continue;
        }
        const structured =
          field.type === "money" ||
          field.type === "object" ||
          field.type === "object-array" ||
          field.type === "json";
        if (typeof raw === "object") {
          // Structured editors parse a JSON string; plain inputs get readable text.
          next[field.name] = structured
            ? JSON.stringify(raw)
            : Array.isArray(raw)
              ? raw
                  .map((item) =>
                    typeof item === "object" ? Object.values(item ?? {}).join(" ") : String(item),
                  )
                  .join(", ")
              : Object.entries(raw as Record<string, unknown>)
                  .map(([k, v]) => `${k} ${String(v)}`)
                  .join(", ");
          continue;
        }
        next[field.name] = String(raw);
      }
      if (isUpdate) {
        pristineRef.current = { ...next };
      }
      return next;
    });
  }, [detail, action, isUpdate]);

  useEffect(() => {
    if (!isUpdate || !values.apply_limits_to_all_operator_games) return;
    const limitFields = ["minimum_stake", "maximum_stake", "maximum_win", "stake", "payout"];
    const source = detail ?? row ?? {};
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const name of limitFields) {
        const current = prev[name];
        const isBlank =
          current === undefined ||
          current === null ||
          current === "" ||
          (typeof current === "string" && current.trim() === "") ||
          (typeof current === "string" && current.trim() === "{}") ||
          (typeof current === "string" && current.trim() === "[]");
        if (!isBlank) continue;
        const raw = source[name];
        if (raw === undefined || raw === null || raw === "") continue;
        next[name] = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [detail, isUpdate, row, values.apply_limits_to_all_operator_games]);

  const selectedGame = useMemo(() => {
    const source = detail ?? row;
    const raw = values.game_id;
    const first = Array.isArray(raw) ? raw[0] : raw;
    const id = String(first ?? source?.game_id ?? "");
    const fromApi =
      typeof source?.master_game_name === "string" && source.master_game_name
        ? source.master_game_name
        : undefined;
    const fromOptions = gameOptions.find((option) => option.value === id)?.label;
    const name =
      fromApi ??
      fromOptions ??
      (typeof source?.partner_game_name === "string" ? source.partner_game_name : undefined) ??
      (typeof source?.game_name === "string" ? source.game_name : undefined) ??
      (typeof values.game_name === "string" ? values.game_name : undefined);
    return { id, name };
  }, [values.game_id, values.game_name, row, detail, gameOptions]);

  const isOperatorGameAction = action.key.startsWith("operator-game");
  const jackpot = isOperatorGameAction && isJackpotGame(selectedGame);
  const denomination = isOperatorGameAction && isDenominationGame(selectedGame);

  // Add-modal multi-selection: any number of partner groups and/or games.
  const isOperatorGameCreate = action.key === "operator-game-create";
  const asList = (value: FormValue): string[] =>
    Array.isArray(value) ? value.filter(Boolean).map(String) : value ? [String(value)] : [];
  const selectedPartnerIds = isOperatorGameCreate ? asList(values.partner_id ?? null) : [];
  const selectedGameIds = isOperatorGameCreate ? asList(values.game_id ?? null) : [];
  const individualGameId = selectedGameIds[0] ?? "";
  const bulkAssign = isOperatorGameCreate && (selectedPartnerIds.length > 0 || selectedGameIds.length > 0);


  // Branding fields only apply to operator games that belong to the house partner (partner_id === 0).
  const partnerId = detail?.partner_id ?? row?.partner_id ?? null;
  const partnerIdIsZero = String(partnerId) === "0";

  // Partner of the game currently picked in the form (used by campaign create).
  const operatorGameRows = useReferenceStore((state) => state.game.rows);
  const catalogGameRows = useReferenceStore((state) => state.catalogGame.rows);
  const gameRows = useMemo(
    () => [...operatorGameRows, ...catalogGameRows],
    [operatorGameRows, catalogGameRows],
  );
  const selectedGamePartnerIsZero = useMemo(() => {
    const id = String(values.game_id ?? "");
    if (!id) return false;
    const match = gameRows.find((r) => String(r.id ?? r.game_id ?? "") === id);
    const pid = match?.partner_id ?? detail?.partner_id ?? null;
    return String(pid) === "0";
  }, [values.game_id, gameRows, detail]);

  // Launch template is irrelevant for "call" launch types.
  const launchType = String(values.launch_type ?? "");

  const { user: authUser } = useAuth();
  // Partner grouping is platform-wide — client admins never pick a partner.
  const hidePartner = isClientAdmin(authUser);

  // Operator input rules:
  // - ADMIN: always pick the operator/client, and it is required.
  // - CLIENT_ADMIN with a single operator: hidden, the API resolves it from the session.
  // - CLIENT_ADMIN with multiple operators: shown and required.
  const assignedClients = useMemo(() => userClients(authUser), [authUser]);
  const clientAdmin = hidePartner || assignedClients.length > 0;
  const singleOperatorClientAdmin = clientAdmin && assignedClients.length <= 1;
  const soleOperatorId = assignedClients.length === 1 ? assignedClients[0].id : null;

  const applyOperatorRule = useCallback(
    (list: ActionField[]) => {
      const isOperator = (field: ActionField) =>
        field.type === "operator" || field.name === "operator_id";
      if (!clientAdmin)
        return list.map((field) => (isOperator(field) ? { ...field, required: true } : field));
      if (singleOperatorClientAdmin) return list.filter((field) => !isOperator(field));
      return list.map((field) => (isOperator(field) ? { ...field, required: true } : field));
    },
    [clientAdmin, singleOperatorClientAdmin],
  );

  const fields = useMemo(() => {
    const all = (action.fields ?? []).filter(
      (field) => !(hidePartner && (field.type === "partner" || field.name === "partner_id")),
    );
    if (action.key === "partner-create" || action.key === "partner-update") {
      return applyOperatorRule(
        all.filter((field) => !(field.name === "launch_template" && launchType === "call")),
      );
    }
    if (action.key === "freebet-campaign-create") {
      return applyOperatorRule(
        all.filter(
          (field) =>
            !["qualification_rules", "config", "configs"].includes(field.name) ||
            selectedGamePartnerIsZero,
        ),
      );
    }
    if (!isOperatorGameAction) return applyOperatorRule(all);
    return applyOperatorRule(
      all.filter((field) => {
        const isSelector =
          field.type === "operator" || field.type === "game" || field.type === "partner";
        if (jackpot) return isSelector || JACKPOT_FIELDS.includes(field.name);
        // total_games (and the other jackpot fields) only exist for jackpot games.
        if (JACKPOT_FIELDS.includes(field.name)) return false;
        // Denomination is always editable on the edit modal.
        if (field.name === "denomination") return isUpdate || denomination;
        // Branding fields are only available for house partner games on the edit modal.
        if (isUpdate && (field.name === "color_scheme" || field.name === "background_image")) {
          return partnerIdIsZero;
        }
        // Display name only applies when an individual game is selected on the add modal.
        if (!isUpdate && field.name === "game_name") return Boolean(individualGameId);
        return true;
      }),
    );
  }, [
    action,
    isOperatorGameAction,
    jackpot,
    denomination,
    isUpdate,
    partnerIdIsZero,
    individualGameId,
    launchType,
    selectedGamePartnerIsZero,
    hidePartner,
    applyOperatorRule,
  ]);

  // When an action wraps fields as an array (e.g. permissions), those fields
  // are rendered in a repeatable group instead of individually.
  const renderFields = useMemo(() => {
    if (!action.wrapAs) return fields;
    const setFields = new Set(action.wrapAs.fields);
    return fields.filter((f) => !setFields.has(f.name));
  }, [fields, action.wrapAs]);

  const isCheckboxMultiWrap = Boolean(
    action.wrapAs &&
    action.wrapAs.fields.some((name) => {
      const fieldDef = (action.fields ?? []).find((field) => field.name === name);
      return fieldDef?.type === "permissions-multi" || fieldDef?.type === "operators-multi";
    }),
  );

  // Keep the operator known to dependent editors (currencies, stake limits) even
  // when the selector is hidden for a single-operator client admin.
  useEffect(() => {
    if (!open || !soleOperatorId) return;
    setValues((prev) => (prev.operator_id ? prev : { ...prev, operator_id: soleOperatorId }));
  }, [open, soleOperatorId]);

  const set = (name: string, value: FormValue) => setValues((prev) => ({ ...prev, [name]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const query: Record<string, QueryValue> = {};
      const jsonBody: Record<string, unknown> = {};
      const form = action.encoding === "multipart" ? new FormData() : null;
      const resolvedOperatorId = String(
        values.operator_id ?? row?.operator_id ?? soleOperatorId ?? "",
      ).trim();
      const operatorCurrencies = resolvedOperatorId
        ? (() => {
            const rowData = useReferenceStore
              .getState()
              .operator.rows.find(
                (candidate) =>
                  String(candidate.id ?? candidate.operator_id ?? "") === resolvedOperatorId,
              );
            return currenciesFromClient(rowData);
          })()
        : [];

      for (const field of renderFields) {
        const raw = values[field.name];
        if (isUpdate && pristineRef.current) {
          const pristine = pristineRef.current[field.name];
          if (valuesEqual(raw, pristine)) continue;
        }
        if (field.type === "file") {
          if (raw instanceof File && form) form.append(field.name, raw);
          continue;
        }
        if (field.inQuery) {
          let coerced;
          try {
            coerced = coerce(field, raw, operatorCurrencies);
          } catch (err) {
            if (isOperatorGameAction && isUpdate && field.name === "denomination") {
              coerced = raw;
            } else throw err;
          }
          if (coerced !== undefined && coerced !== "") query[field.name] = coerced as QueryValue;
          continue;
        }
        if (field.type === "boolean") {
          if (!raw) continue;
          if (form) form.append(field.name, "1");
          else jsonBody[field.name] = true;
          continue;
        }
        let coerced;
        try {
          coerced = coerce(field, raw, operatorCurrencies);
        } catch (err) {
          if (isOperatorGameAction && isUpdate && field.name === "denomination") {
            coerced = raw;
          } else throw err;
        }
        if (coerced === undefined) continue;
        if (form) {
          // Multipart requests should carry JSON-like object values as plain strings,
          // not blob/file uploads. The backend validates the field names by parsing
          // the string value, and blob-backed multipart entries are treated as files.
          if (
            typeof coerced === "object" ||
            field.type === "money" ||
            field.type === "object" ||
            field.type === "object-array" ||
            field.type === "json"
          ) {
            form.append(field.name, JSON.stringify(coerced));
            continue;
          }
          form.append(field.name, String(coerced));
        } else {
          jsonBody[field.name] = coerced;
        }
      }

      // Group fields sharing an arrayKey into a single-object array.
      const groups = new Map<string, Record<string, unknown>>();
      for (const field of fields) {
        if (!field.arrayKey) continue;
        if (field.name in jsonBody) {
          const entry = groups.get(field.arrayKey) ?? {};
          entry[field.name] = jsonBody[field.name];
          groups.set(field.arrayKey, entry);
          delete jsonBody[field.name];
        }
      }
      for (const [key, entry] of groups) {
        if (Object.keys(entry).length === 0) continue;
        // A multi-select inside a group fans out into one object per value.
        const multi = Object.entries(entry).find(([, v]) => Array.isArray(v));
        if (multi) {
          const [multiName, list] = multi as [string, unknown[]];
          jsonBody[key] = list.map((item) => ({ ...entry, [multiName]: item }));
        } else {
          jsonBody[key] = [entry];
        }
      }

      // If this action wraps fields as an array, include all repeatable
      // entries built in the dialog.
      if (action.wrapAs) {
        const entries: Record<string, unknown>[] = [];
        for (const rowEntry of wrapEntries) {
          const obj: Record<string, unknown> = {};
          for (const name of action.wrapAs.fields) {
            const fieldDef = (action.fields ?? []).find((f) => f.name === name);
            if (!fieldDef) continue;
            let coerced;
            try {
              coerced = coerce(fieldDef, rowEntry[name]);
            } catch (err) {
              if (isOperatorGameAction && isUpdate && fieldDef.name === "denomination") {
                coerced = rowEntry[name];
              } else throw err;
            }
            if (coerced !== undefined) obj[name] = coerced;
          }
          if (Object.keys(obj).length === 0) continue;
          if (Array.isArray(obj.permission_id)) {
            for (const permissionId of obj.permission_id) {
              entries.push({ ...obj, permission_id: permissionId });
            }
            continue;
          }
          entries.push(obj);
        }
        if (entries.length > 0) {
          if (form) {
            form.append(action.wrapAs.key, JSON.stringify(entries));
          } else {
            jsonBody[action.wrapAs.key] = entries;
          }
        }
      }

      // Bulk mode: assign every game of the selected partner group(s) plus any
      // individually ticked games, skipping the ones already assigned.
      if (bulkAssign) {
        const operatorId = String(values.operator_id ?? row?.operator_id ?? soleOperatorId ?? "");
        const partnerIds = selectedPartnerIds;
        const wantsTopGames = partnerIds.includes(TOP_GAMES_VALUE);
        const realPartnerIds = partnerIds.filter((id) => id !== TOP_GAMES_VALUE);

        const needsCatalogue = partnerIds.length > 0;
        const [catalogue, existing] = await Promise.all([
          needsCatalogue
            ? apiRequest("/api/v1/games", { query: { page: 1, per_page: 100000 } })
            : Promise.resolve(null),
          apiRequest("/api/v1/operator-games", {
            query: { page: 1, per_page: 500, operator_id: operatorId },
          }).catch(() => null),
        ]);

        const assigned = new Set(
          normalizeList(existing)
            .rows.map((item) => item.game_id ?? item.id)
            .filter((id) => id !== undefined && id !== null)
            .map((id) => String(id)),
        );

        const catalogueRows = catalogue ? normalizeList(catalogue).rows : [];
        const wanted = new Set<string>(selectedGameIds);

        if (wantsTopGames) {
          const top = resolveTopGameIds(catalogueRows);
          if (top.length === 0) {
            throw new Error(
              "No top games are configured (see VITE_TOP_GAME_IDS / VITE_TOP_GAME_NAMES).",
            );
          }
          for (const id of top) wanted.add(String(id));
        }
        for (const partnerId of realPartnerIds) {
          for (const item of catalogueRows) {
            if (String(item.partner_id ?? "") !== partnerId) continue;
            const id = item.id ?? item.game_id;
            if (id === undefined || id === null) continue;
            wanted.add(String(id));
          }
        }

        const all = Array.from(wanted);
        const pending = all.filter((id) => !assigned.has(id));
        if (all.length === 0) {
          throw new Error("No games matched the selected partner group(s).");
        }

        const base = { ...jsonBody };
        delete base.partner_id;
        delete base.game_id;
        if (selectedGameIds.length !== 1) delete base.game_name;
        if (operatorId) base.operator_id = Number.isNaN(Number(operatorId)) ? operatorId : Number(operatorId);

        const added: string[] = [];
        const failed: { game_id: string; message: string }[] = [];
        for (const gameId of pending) {
          try {
            await apiRequest("/api/v1/operator-games", {
              method: "POST",
              body: { ...base, game_id: Number(gameId) },
            });
            added.push(gameId);
          } catch (error) {
            failed.push({
              game_id: gameId,
              message: error instanceof Error ? error.message : "Failed",
            });
          }
        }

        if (added.length === 0 && failed.length > 0) {
          const messages = Array.from(new Set(failed.map((item) => item.message)));
          throw new Error(`No games were added. ${messages.join(" · ")}`);
        }

        const skipped = all.length - pending.length;
        return {
          status_description: `Added ${added.length} game(s) · skipped ${skipped} already assigned${
            failed.length > 0 ? ` · ${failed.length} failed` : ""
          }`,
          data: { added, skipped, failed },
        };
      }


      // Operator game requests always carry the operator: admins pick it in the
      // dialog (or it comes from the row), client admins get their sole operator.
      if (isOperatorGameAction) {
        const resolvedOperatorId = String(
          values.operator_id ?? row?.operator_id ?? soleOperatorId ?? "",
        ).trim();
        if (resolvedOperatorId) {
          if (form) {
            if (!form.has("operator_id")) form.append("operator_id", resolvedOperatorId);
          } else if (jsonBody.operator_id === undefined) {
            jsonBody.operator_id = Number.isNaN(Number(resolvedOperatorId))
              ? resolvedOperatorId
              : Number(resolvedOperatorId);
          }
        }
      }

      const path = resolvePath(action, row, jsonBody);
      const hasBody = form ? true : Object.keys(jsonBody).length > 0;
      const viteEnv = import.meta.env as { DEV?: boolean };

      // DEV-only: inspect multipart FormData to help debug server 400s
      if (form && viteEnv.DEV) {
        (async () => {
          try {
            const seen: Array<Record<string, string>> = [];
            for (const [k, v] of (form as FormData).entries()) {
              if (v instanceof Blob) {
                let text = "";
                try {
                  // Blob.text() is supported in modern browsers.
                  text = await (v as Blob).text();
                } catch {
                  try {
                    // Fallback: toString
                    text = String(v);
                  } catch {
                    text = "<unreadable blob>";
                  }
                }
                seen.push({
                  key: k,
                  contentType: (v as Blob).type || "blob",
                  preview: text.slice(0, 500),
                });
              } else {
                seen.push({ key: k, contentType: typeof v, preview: String(v).slice(0, 500) });
              }
            }
            console.debug("ActionDialog outgoing multipart:", { path, seen });
          } catch (err) {
            console.debug("ActionDialog FormData inspect failed", err);
          }
        })();
      }

      return apiRequest(path, {
        method: action.method,
        query: Object.keys(query).length > 0 ? query : undefined,
        body: action.method === "DELETE" ? undefined : hasBody ? (form ?? jsonBody) : undefined,
      });
    },
    onSuccess: (data) => {
      mutation.reset();
      setSubmitAttempted(false);
      const dict = data && typeof data === "object" && !Array.isArray(data) ? (data as Dict) : null;
      const description =
        (typeof dict?.status_description === "string" && dict.status_description) ||
        (typeof dict?.message === "string" && dict.message) ||
        undefined;
      // Surface the whole API response (including per-game failures) in the dialog.
      setResult(data ?? null);
      const nested = dict?.data as { failed?: { game_id: string; message: string }[] } | undefined;
      const failed = Array.isArray(nested?.failed) ? nested!.failed! : [];
      setFailures(failed);
      toast.success(description ?? `${action.label} succeeded`);
      for (const message of Array.from(new Set(failed.map((item) => item.message)))) {
        toast.error(message);
      }

      // Keep reference dropdowns (operators, partners, roles…) in sync after
      // create/update/delete so newly added records show up immediately.
      const refresh = useReferenceStore.getState().refresh;
      if (action.path.includes("/clients")) void refresh("operator");
      if (action.path.includes("/partners")) void refresh("partner");
      if (action.path.includes("/roles")) void refresh("role");
      if (action.path.includes("/permissions")) void refresh("permission");
      onSuccess?.(data);

      // Keep the operator-game add modal open so the operator and other form values
      // remain available for the next game assignment without retyping.
      if (action.key === "operator-game-create") return;

      onOpenChange(false);
    },
    onError: () => {
      // Keep the dialog open and preserve all entered values so the user can
      // review the inline error, fix the input, and retry without retyping.
    },
  });

  const missing = renderFields
    .filter((field) => {
      if (!field.required) return false;
      const value = values[field.name];
      if (Array.isArray(value)) return value.length === 0;
      return value === "" || value === null;
    })
    .slice();

  if (action.wrapAs) {
    const wrapDefs = (action.fields ?? []).filter((f) => action.wrapAs!.fields.includes(f.name));
    const wrapMissing =
      wrapEntries.length === 0 ||
      wrapEntries.some((entry) =>
        wrapDefs.some((d) => {
          const value = (entry as Record<string, unknown>)[d.name];
          return (
            d.required &&
            (value === "" ||
              value === null ||
              value === undefined ||
              (Array.isArray(value) && value.length === 0))
          );
        }),
      );
    if (wrapMissing)
      missing.push({ name: action.wrapAs.key, label: action.wrapAs.key } as ActionField);
  }

  const gameScope = useReferenceStore((state) => state.gameScope);
  const gameLoading = useReferenceStore((state) => state.game.loading);
  const selectedOperatorId = String(values.operator_id ?? "");
  const showFullPageShimmer =
    isOperatorGameAction && selectedOperatorId && gameScope === selectedOperatorId && gameLoading;
  const mutationErrorLines = (() => {
    const payload =
      mutation.error && typeof mutation.error === "object" && "payload" in mutation.error
        ? (mutation.error as { payload?: unknown }).payload
        : undefined;
    const validationErrors = payload ? fieldErrors(payload) : [];
    const message =
      extractMessage(payload ?? mutation.error ?? null) ??
      (mutation.error instanceof Error ? mutation.error.message : null) ??
      "The request failed.";
    return [...validationErrors, message].filter(
      (line, index, all) => line && all.indexOf(line) === index,
    );
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        mutation.reset();
        setResult(null);
        setSubmitAttempted(false);
        if (!next) pristineRef.current = null;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {action.label}
            {row && action.idKey ? (
              <span className="num ml-2 text-xs text-muted-foreground">
                #{String(row[action.idKey] ?? "")}
              </span>
            ) : null}
          </DialogTitle>
          {stripEndpoint(action.description) ? (
            <DialogDescription className="num text-xs">
              {stripEndpoint(action.description)}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <form
          className="relative space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.reset();
            setResult(null);
            setSubmitAttempted(true);
            mutation.mutate();
          }}
        >
          {detailQuery.isFetching ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading game details…
            </p>
          ) : null}

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This action takes no parameters. Confirm to send the request.
            </p>
          ) : null}

          {showFullPageShimmer ? (
            <div className="absolute inset-0 z-10 flex flex-col gap-3 rounded-lg bg-card/95 p-1 backdrop-blur-sm">
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-input bg-muted/40">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
              </div>
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-input bg-muted/40">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
              </div>
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-input bg-muted/40">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
              </div>
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-input bg-muted/40">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
              </div>
              <div className="relative h-9 w-full overflow-hidden rounded-md border border-input bg-muted/40">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
              </div>
            </div>
          ) : null}

          {renderFields.map((field) => {
            const lockedByGroup =
              action.key === "operator-game-create" &&
              ((field.type === "partner" && Boolean(individualGameId)) ||
                (field.type === "game" && Boolean(partnerGroupId)));
            return (
              <div key={field.name} className="flex flex-col gap-1.5">
                <label htmlFor={`${action.key}-${field.name}`} className="label-eyebrow">
                  {field.label}
                  {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                </label>
                {isUpdate && field.type === "game" ? (
                  // The game of an existing assignment can't be changed.
                  <p className="num flex h-9 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
                    {selectedGame.name ?? "—"}
                    {selectedGame.id ? (
                      <span className="ml-2 opacity-60">#{selectedGame.id}</span>
                    ) : null}
                  </p>
                ) : (
                  <FieldInput
                    id={`${action.key}-${field.name}`}
                    field={field}
                    value={values[field.name]}
                    values={values}
                    disabled={lockedByGroup}
                    onChange={(value) => set(field.name, value)}
                  />
                )}
                {lockedByGroup ? (
                  <p className="text-[11px] text-muted-foreground">
                    Disabled —{" "}
                    <button
                      type="button"
                      onClick={() => {
                        if (field.type === "partner") {
                          set("game_id", "");
                          set("game_name", "");
                        } else {
                          set("partner_id", "");
                        }
                      }}
                      className="inline text-[11px] text-primary underline hover:text-primary/80"
                    >
                      clear the {field.type === "partner" ? "individual game" : "partner group"}
                    </button>{" "}
                    to switch.
                  </p>
                ) : null}
                {field.help ? (
                  <p className="text-[11px] text-muted-foreground">{field.help}</p>
                ) : null}
              </div>
            );
          })}

          {action.wrapAs ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="label-eyebrow">{action.wrapAs.key}</div>
                {!isCheckboxMultiWrap ? (
                  <button
                    type="button"
                    onClick={() =>
                      setWrapEntries((prev) => [
                        ...prev,
                        Object.fromEntries(action.wrapAs!.fields.map((n) => [n, ""])),
                      ])
                    }
                    className="text-[12px] text-primary"
                  >
                    + Add
                  </button>
                ) : null}
              </div>
              {wrapEntries.map((entry, idx) => (
                <div key={idx} className="rounded-md border border-input p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      {action.wrapAs!.fields.map((name) => {
                        const fieldDef = (action.fields ?? []).find((f) => f.name === name)!;
                        return (
                          <div key={name} className="flex flex-col gap-1.5">
                            <label className="label-eyebrow">{fieldDef.label}</label>
                            <FieldInput
                              id={`${action.key}-wrap-${idx}-${name}`}
                              field={fieldDef}
                              value={entry[name]}
                              values={values}
                              onChange={(v) =>
                                setWrapEntries((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, [name]: v } : r)),
                                )
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                    {!isCheckboxMultiWrap ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setWrapEntries((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-8 w-8 rounded-md border border-border text-destructive"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {result ? (
            <div className="rounded-md border border-success/40 bg-success/10 p-3">
              <p className="text-sm font-medium text-success">Success</p>
              {typeof result === "object" && result !== null && "status_description" in result ? (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {String((result as Record<string, unknown>).status_description)}
                </p>
              ) : (
                <div className="mt-2 text-muted-foreground">
                  <ReadableValue value={result} />
                </div>
              )}
            </div>
          ) : null}

          {submitAttempted && mutation.isError && mutationErrorLines.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-left">
              <p className="text-sm font-medium text-destructive">Request failed</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive/90">
                {mutationErrorLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || missing.length > 0}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50",
                action.danger
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              ) : null}
              Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const inputClass =
  "num h-9 w-full rounded-md border border-input bg-surface px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/70 focus:ring-2 focus:ring-ring";

function FieldInput({
  id,
  field,
  value,
  values,
  disabled,
  onChange,
}: {
  id: string;
  field: ActionField;
  value: FormValue;
  values: Record<string, FormValue>;
  disabled?: boolean;
  onChange: (value: FormValue) => void;
}) {
  if (
    field.type === "operator" ||
    field.type === "game" ||
    field.type === "permission" ||
    field.type === "role" ||
    field.type === "partner"
  ) {
    return (
      <ReferenceSelect
        id={id}
        kind={field.type === "game" && field.catalog ? "catalogGame" : field.type}
        required={field.required}
        groupBy={field.groupBy}
        extraGroup={
          field.topGroup
            ? {
                label: TOP_GAMES_LABEL,
                options: [{ value: TOP_GAMES_VALUE, label: "Add all top games" }],
              }
            : undefined
        }
        disabled={disabled}
        operatorId={
          field.type === "game" && !field.catalog ? String(values.operator_id ?? "") : undefined
        }
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "operators-multi") {
    return (
      <MultiReferenceSelect
        id={id}
        kind="operator"
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    );
  }

  if (field.type === "permissions-multi") {
    return (
      <MultiReferenceSelect
        id={id}
        kind="permission"
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
      />
    );
  }

  if (field.type === "color") {
    const hex = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={hex}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-surface p-1"
        />
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#000000"
          className={cn(inputClass, "num flex-1")}
        />
      </div>
    );
  }

  if (field.type === "currency") {
    return (
      <CurrencySelect
        id={id}
        required={field.required}
        operatorId={field.dependsOn ? String(values[field.dependsOn] ?? "") : ""}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        readOnly={field.readOnly}
      />
    );
  }

  if (field.type === "currency-multi") {
    return (
      <CurrencyMultiSelect
        id={id}
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "money") {
    return (
      <MoneyEditor
        id={id}
        operatorId={String(values[field.dependsOn ?? "operator_id"] ?? "")}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "object") {
    if (field.name === "denomination") {
      return (
        <DenominationEditor
          id={id}
          operatorId={String(values[field.dependsOn ?? "operator_id"] ?? "")}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      );
    }
    return (
      <ObjectEditor
        id={id}
        subFields={field.subFields ?? []}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "object-array") {
    return (
      <ObjectArrayEditor
        id={id}
        subFields={field.subFields ?? []}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    );
  }

  if (field.type === "select") {
    return (
      <SearchableSelect
        id={id}
        value={typeof value === "string" ? value : ""}
        options={field.options ?? []}
        placeholder={field.label}
        required={field.required}
        onChange={onChange}
        buttonClassName={inputClass}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Enabled
      </label>
    );
  }

  if (field.type === "file") {
    return (
      <input
        id={id}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground"
      />
    );
  }

  if (field.type === "json") {
    return (
      <JsonEditor
        id={id}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={onChange}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        id={id}
        rows={2}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputClass, "h-auto py-2")}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DateField
        id={id}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder ?? "Pick a date"}
        onChange={onChange}
      />
    );
  }

  return (
    <input
      id={id}
      type={
        field.type === "datetime"
          ? "datetime-local"
          : field.type === "number" || field.type === "decimal"
            ? "number"
            : "text"
      }

      step={field.type === "decimal" ? "any" : undefined}
      value={typeof value === "string" ? value : ""}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

function CurrencySelect({
  id,
  operatorId,
  value,
  onChange,
  required,
  readOnly,
}: {
  id: string;
  operatorId: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
}) {
  const state = useReferenceStore((s) => s.operator);
  const ensure = useReferenceStore((s) => s.ensure);
  useMemoEnsure(ensure);

  const currencies = useMemo(() => {
    if (!operatorId) return [];
    const row = state.rows.find((r) => String(r.id ?? r.operator_id ?? "") === String(operatorId));
    return currenciesFromClient(row);
  }, [operatorId, state.rows]);

  // Prefill the operator's default currency as soon as an operator is picked.
  useEffect(() => {
    if (!operatorId || currencies.length === 0) return;
    if (!value || !currencies.includes(value)) onChange(currencies[0]);
  }, [operatorId, currencies, value, onChange]);

  const placeholder = !operatorId
    ? "Select an operator first"
    : state.loading
      ? "Loading…"
      : currencies.length === 0
        ? "No currencies configured"
        : "Select currency";

  return (
    <select
      id={id}
      value={value}
      disabled={readOnly || !operatorId || currencies.length === 0}
      onChange={(event) => onChange(event.target.value)}
      className={cn(inputClass, required && !value && "border-primary/40")}
    >
      <option value="">{placeholder}</option>
      {currencies.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {value && !currencies.includes(value) ? <option value={value}>{value}</option> : null}
    </select>
  );
}

function useMemoEnsure(ensure: (kind: "operator") => Promise<void>) {
  // Ensure the operator (client) list is loaded so we can read currencies from it.
  useMemo(() => {
    void ensure("operator");
    return null;
  }, [ensure]);
}

// Searchable, multi-select currency picker producing a comma-joined string.
function CurrencyMultiSelect({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = useMemo(
    () =>
      value
        .split(",")
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
    [value],
  );
  const options = useMemo(() => {
    const term = search.trim().toUpperCase();
    return CURRENCY_OPTIONS.filter((o) => !term || o.value.includes(term));
  }, [search]);

  const toggle = (code: string) => {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    onChange(next.join(","));
  };

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(inputClass, "flex items-center justify-between text-left")}
      >
        <span className="truncate">
          {selected.length === 0 ? (placeholder ?? "Select currencies") : selected.join(", ")}
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover p-1 shadow-lg">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search currencies…"
              className={cn(inputClass, "mb-1 h-8 text-xs")}
            />
            <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-muted-foreground">
              <span>{selected.length === 0 ? "None selected" : `${selected.length} selected`}</span>
              <button type="button" onClick={() => onChange("")} className="hover:text-foreground">
                Clear
              </button>
            </div>
            <div className="max-h-56 overflow-auto">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  <span className="num truncate">{option.label}</span>
                </label>
              ))}
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No currencies match your search.
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// JsonEditor: friendly key/value UI that serializes to a JSON string so the
// existing `coerce()` logic keeps working. Falls back to raw JSON for arrays
// or anything that isn't a plain object, and offers an "Edit as JSON" toggle.
// ---------------------------------------------------------------------------

type KV = {
  id: number;
  key: string;
  value: string;
  kind: "string" | "number" | "boolean" | "json";
};

function parseInitial(
  value: string,
): { kind: "object"; rows: KV[] } | { kind: "raw"; text: string } {
  const trimmed = value.trim();
  if (!trimmed) return { kind: "object", rows: [] };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rows: KV[] = Object.entries(parsed).map(([k, v], i) => toRow(i, k, v));
      return { kind: "object", rows };
    }
  } catch {
    /* fall through */
  }
  return { kind: "raw", text: value };
}

function toRow(id: number, key: string, v: unknown): KV {
  if (typeof v === "number") return { id, key, value: String(v), kind: "number" };
  if (typeof v === "boolean") return { id, key, value: v ? "true" : "false", kind: "boolean" };
  if (typeof v === "string") return { id, key, value: v, kind: "string" };
  return { id, key, value: JSON.stringify(v), kind: "json" };
}

function rowsToJson(rows: KV[]): string {
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.key) continue;
    if (r.kind === "number") {
      const n = Number(r.value);
      out[r.key] = Number.isFinite(n) ? n : r.value;
    } else if (r.kind === "boolean") {
      out[r.key] = r.value === "true";
    } else if (r.kind === "json") {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch {
        out[r.key] = r.value;
      }
    } else {
      out[r.key] = r.value;
    }
  }
  return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

function JsonEditor({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const initial = useMemo(() => parseInitial(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<"fields" | "raw">(initial.kind === "raw" ? "raw" : "fields");
  const [rows, setRows] = useState<KV[]>(initial.kind === "object" ? initial.rows : []);
  const [nextId, setNextId] = useState<number>(rows.length);
  const [raw, setRaw] = useState<string>(value);

  const emit = (next: KV[]) => {
    setRows(next);
    onChange(rowsToJson(next));
  };

  const updateRow = (rowId: number, patch: Partial<KV>) => {
    emit(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const kind: KV["kind"] =
      placeholder && /^\{\s*"[^"]+"\s*:\s*\d/.test(placeholder) ? "number" : "string";
    const next = [...rows, { id: nextId, key: "", value: "", kind }];
    setNextId(nextId + 1);
    emit(next);
  };

  const removeRow = (rowId: number) => emit(rows.filter((r) => r.id !== rowId));

  const switchToRaw = () => {
    setRaw(value || rowsToJson(rows));
    setMode("raw");
  };

  const switchToFields = () => {
    const parsed = parseInitial(raw);
    if (parsed.kind === "object") {
      setRows(parsed.rows.map((r, i) => ({ ...r, id: i })));
      setNextId(parsed.rows.length);
      onChange(rowsToJson(parsed.rows));
      setMode("fields");
    } else {
      // Not an object — keep raw mode
      setMode("raw");
    }
  };

  if (mode === "raw") {
    return (
      <div className="space-y-1.5">
        <textarea
          id={id}
          rows={3}
          value={raw}
          placeholder={placeholder}
          onChange={(event) => {
            setRaw(event.target.value);
            onChange(event.target.value);
          }}
          className={cn(inputClass, "h-auto py-2 font-mono text-[12px]")}
        />
        <button
          type="button"
          onClick={switchToFields}
          className="text-[11px] text-primary hover:underline"
        >
          ← Back to fields
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-input bg-surface/60 p-2">
      {rows.length === 0 ? (
        <p className="px-1 py-1.5 text-[11px] text-muted-foreground">
          No fields yet. Add a key and value below.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <input
                type="text"
                value={row.key}
                placeholder="key"
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
                className={cn(inputClass, "h-8 flex-1 text-[12px]")}
              />
              <span className="text-muted-foreground">:</span>
              {row.kind === "boolean" ? (
                <select
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  className={cn(inputClass, "h-8 flex-1 text-[12px]")}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={row.kind === "number" ? "number" : "text"}
                  step={row.kind === "number" ? "any" : undefined}
                  value={row.value}
                  placeholder={row.kind === "json" ? '{"nested":1}' : "value"}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  className={cn(inputClass, "h-8 flex-1 text-[12px]")}
                />
              )}
              <select
                value={row.kind}
                onChange={(e) => updateRow(row.id, { kind: e.target.value as KV["kind"] })}
                className={cn(inputClass, "h-8 w-[88px] text-[11px]")}
                title="Value type"
              >
                <option value="string">text</option>
                <option value="number">number</option>
                <option value="boolean">bool</option>
                <option value="json">json</option>
              </select>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={switchToRaw}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Edit as JSON
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MoneyEditor: one numeric input per currency; produces `{KES: 10, USD: 1}`.
// Currencies come from the selected operator's client settings plus any
// currencies already present in the incoming value.
// ---------------------------------------------------------------------------

function parseMoney(value: string): Record<string, string> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = v === null || v === undefined ? "" : String(v);
      }
      return out;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function moneyToJson(map: Record<string, string>): string {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === "" || v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

function parseDenomination(
  value: string,
  fallbackCurrency: string,
  currencies: string[] = [],
): Record<string, number[]> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          const list = v.map((item) => Number(item)).filter((item) => Number.isFinite(item));
          if (list.length > 0) out[k] = list;
        } else if (v !== null && v !== undefined) {
          const n = Number(v);
          if (Number.isFinite(n)) out[k] = [n];
        }
      }
      return out;
    }
  } catch {
    // fall through to comma-list parsing below
  }

  const list = trimmed
    .split(",")
    .map((segment) => Number(segment.trim()))
    .filter((value) => Number.isFinite(value));
  if (list.length === 0) return {};

  const baseCurrencies = currencies.length > 0 ? currencies : [fallbackCurrency || "USD"];
  return Object.fromEntries(baseCurrencies.map((currency) => [currency.toUpperCase(), list]));
}

function denominationToJson(map: Record<string, number[]>): string {
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(map)) {
    const list = Array.isArray(v) ? v.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
    if (list.length > 0) out[k] = list;
  }
  return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

function DenominationEditor({
  id,
  operatorId,
  value,
  onChange,
}: {
  id: string;
  operatorId: string;
  value: string;
  onChange: (value: FormValue) => void;
}) {
  const state = useReferenceStore((s) => s.operator);
  const ensure = useReferenceStore((s) => s.ensure);
  useMemoEnsure(ensure);

  const [map, setMap] = useState<Record<string, number[]>>(() => {
    const operatorCurrencies = operatorId
      ? (() => {
          const row = state.rows.find(
            (r) => String(r.id ?? r.operator_id ?? "") === String(operatorId),
          );
          return currenciesFromClient(row);
        })()
      : [];
    const fallbackCurrency = operatorCurrencies[0] ?? "USD";
    return parseDenomination(value, fallbackCurrency, operatorCurrencies);
  });

  useEffect(() => {
    const operatorCurrencies = operatorId
      ? (() => {
          const row = state.rows.find(
            (r) => String(r.id ?? r.operator_id ?? "") === String(operatorId),
          );
          return currenciesFromClient(row);
        })()
      : [];
    const fallbackCurrency = operatorCurrencies[0] ?? "USD";
    if (denominationToJson(map) === value) return;
    setMap(parseDenomination(value, fallbackCurrency, operatorCurrencies));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, value]);

  const operatorCurrencies = useMemo(() => {
    if (!operatorId) return [] as string[];
    const row = state.rows.find((r) => String(r.id ?? r.operator_id ?? "") === String(operatorId));
    return currenciesFromClient(row);
  }, [operatorId, state.rows]);

  const currencies = useMemo(() => {
    const set = new Set<string>([...operatorCurrencies, ...Object.keys(map)]);
    return Array.from(set);
  }, [operatorCurrencies, map]);

  const update = (ccy: string, next: number[]) => {
    const nextMap = { ...map, [ccy]: next };
    setMap(nextMap);
    onChange(denominationToJson(nextMap));
  };

  const updateText = (ccy: string, text: string) => {
    const list = text
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((n) => Number.isFinite(n));
    update(ccy, list);
  };

  return (
    <div className="space-y-1.5 rounded-md border border-input bg-surface/60 p-2" id={id}>
      {currencies.length === 0 ? (
        <p className="px-1 py-1.5 text-[11px] text-muted-foreground">
          {operatorId
            ? "No currencies configured for this operator."
            : "Select an operator to load currencies, or add one manually."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {currencies.map((ccy) => (
            <div key={ccy} className="flex items-center gap-2">
              <span className="num w-14 text-[12px] font-medium text-muted-foreground">{ccy}</span>
              <input
                type="text"
                value={(map[ccy] ?? []).join(", ")}
                onChange={(e) => updateText(ccy, e.target.value)}
                className={cn(inputClass, "h-8 flex-1 text-[12px]")}
                placeholder="10, 20, 50, 100"
              />
            </div>
          ))}
        </div>
      )}
      <div className="pt-1">
        <p className="text-[11px] text-muted-foreground">
          Use ISO currency keys, e.g. {'{"USD": [10, 20, 50, 100]}'}.
        </p>
      </div>
    </div>
  );
}

function MoneyEditor({
  id,
  operatorId,
  value,
  onChange,
}: {
  id: string;
  operatorId: string;
  value: string;
  onChange: (value: FormValue) => void;
}) {
  const state = useReferenceStore((s) => s.operator);
  const ensure = useReferenceStore((s) => s.ensure);
  useMemoEnsure(ensure);

  const [map, setMap] = useState<Record<string, string>>(() => parseMoney(value));
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState("");

  // The dialog prefills asynchronously (GET /api/v1/operator-games), so the
  // incoming value arrives after mount — resync when it changes externally.
  useEffect(() => {
    if (moneyToJson(map) === value) return;
    setMap(parseMoney(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const operatorCurrencies = useMemo(() => {
    if (!operatorId) return [] as string[];
    const row = state.rows.find((r) => String(r.id ?? r.operator_id ?? "") === String(operatorId));
    return currenciesFromClient(row);
  }, [operatorId, state.rows]);

  const currencies = useMemo(() => {
    const set = new Set<string>([...operatorCurrencies, ...Object.keys(map)]);
    return Array.from(set);
  }, [operatorCurrencies, map]);

  const update = (ccy: string, v: string) => {
    const next = { ...map, [ccy]: v };
    setMap(next);
    onChange(moneyToJson(next));
  };

  const addCurrency = () => {
    const code = addCode.trim().toUpperCase();
    if (!code) return;
    if (!(code in map)) update(code, "");
    setAddCode("");
    setAddOpen(false);
  };

  return (
    <div className="space-y-1.5 rounded-md border border-input bg-surface/60 p-2" id={id}>
      {currencies.length === 0 ? (
        <p className="px-1 py-1.5 text-[11px] text-muted-foreground">
          {operatorId
            ? "No currencies configured for this operator."
            : "Select an operator to load currencies, or add one manually."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {currencies.map((ccy) => (
            <div key={ccy} className="flex items-center gap-2">
              <span className="num w-14 text-[12px] font-medium text-muted-foreground">{ccy}</span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={map[ccy] ?? ""}
                onChange={(e) => update(ccy, e.target.value)}
                className={cn(inputClass, "h-8 flex-1 text-[12px]")}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}
      <div className="pt-1">
        <p className="text-[11px] text-muted-foreground">
          Use the listed currencies or enter them directly in your request payload if needed.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectEditor / ObjectArrayEditor: labeled sub-inputs that serialise to a
// nested JSON payload. Supports declared subFields plus ad-hoc extras.
// ---------------------------------------------------------------------------

function parseObject(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

function parseArray(value: string): Record<string, unknown>[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed))
      return parsed.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  } catch {
    /* ignore */
  }
  return [];
}

function toInputValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function objectFromSubValues(
  subFields: ActionField[],
  values: Record<string, string>,
  extras: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of subFields) {
    const raw = values[f.name];
    if (raw === undefined || raw === "") continue;
    if (f.type === "number") {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) out[f.name] = n;
    } else if (f.type === "decimal") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[f.name] = n;
    } else out[f.name] = raw;
  }
  for (const [k, v] of Object.entries(extras)) {
    if (!k || v === "") continue;
    // Try number, else string.
    const n = Number(v);
    out[k] = Number.isFinite(n) && v.trim() !== "" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? n : v;
  }
  return out;
}

function ObjectEditor({
  id,
  subFields,
  value,
  onChange,
}: {
  id: string;
  subFields: ActionField[];
  value: string;
  onChange: (value: FormValue) => void;
}) {
  const initial = useMemo(() => parseObject(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const knownNames = useMemo(() => new Set(subFields.map((f) => f.name)), [subFields]);

  const [vals, setVals] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of subFields) out[f.name] = toInputValue(initial[f.name]);
    return out;
  });
  const [extras, setExtras] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial)) {
      if (!knownNames.has(k)) out[k] = toInputValue(v);
    }
    return out;
  });

  const emit = (nextVals: Record<string, string>, nextExtras: Record<string, string>) => {
    const obj = objectFromSubValues(subFields, nextVals, nextExtras);
    onChange(Object.keys(obj).length === 0 ? "" : JSON.stringify(obj));
  };

  const setVal = (name: string, v: string) => {
    const next = { ...vals, [name]: v };
    setVals(next);
    emit(next, extras);
  };

  const [newKey, setNewKey] = useState("");
  const addExtra = () => {
    const k = newKey.trim();
    if (!k || knownNames.has(k) || k in extras) return;
    const next = { ...extras, [k]: "" };
    setExtras(next);
    setNewKey("");
    emit(vals, next);
  };
  const setExtra = (k: string, v: string) => {
    const next = { ...extras, [k]: v };
    setExtras(next);
    emit(vals, next);
  };
  const removeExtra = (k: string) => {
    const next = { ...extras };
    delete next[k];
    setExtras(next);
    emit(vals, next);
  };

  return (
    <div className="space-y-2 rounded-md border border-input bg-surface/60 p-2" id={id}>
      {subFields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground">{f.label}</label>
          {f.type === "object-array" ? (
            <ObjectArrayEditor
              id={`${id}-${f.name}`}
              subFields={f.subFields ?? []}
              value={toInputValue(initial[f.name] ?? [])}
              onChange={(v) => setVal(f.name, typeof v === "string" ? v : "")}
            />
          ) : (
            <input
              type={f.type === "number" || f.type === "decimal" ? "number" : "text"}
              step={f.type === "decimal" ? "any" : undefined}
              value={vals[f.name] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setVal(f.name, e.target.value)}
              className={cn(inputClass, "h-8 text-[12px]")}
            />
          )}
        </div>
      ))}

      {Object.keys(extras).length > 0 ? (
        <div className="space-y-1.5 border-t border-border/60 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Extra fields</p>
          {Object.entries(extras).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-24 truncate text-[12px] text-muted-foreground">{k}</span>
              <input
                type="text"
                value={v}
                onChange={(e) => setExtra(k, e.target.value)}
                className={cn(inputClass, "h-8 flex-1 text-[12px]")}
              />
              <button
                type="button"
                onClick={() => removeExtra(k)}
                className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ObjectArrayEditor({
  id,
  subFields,
  value,
  onChange,
}: {
  id: string;
  subFields: ActionField[];
  value: string;
  onChange: (value: FormValue) => void;
}) {
  const initial = useMemo(() => parseArray(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<Record<string, string>[]>(() =>
    initial.map((r) => {
      const out: Record<string, string> = {};
      for (const f of subFields) out[f.name] = toInputValue(r[f.name]);
      return out;
    }),
  );

  const emit = (next: Record<string, string>[]) => {
    const arr = next
      .map((r) => objectFromSubValues(subFields, r, {}))
      .filter((o) => Object.keys(o).length > 0);
    onChange(arr.length === 0 ? "" : JSON.stringify(arr));
  };

  const setCell = (i: number, name: string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [name]: v } : r));
    setRows(next);
    emit(next);
  };

  const addRow = () => {
    const blank: Record<string, string> = {};
    for (const f of subFields) blank[f.name] = "";
    const next = [...rows, blank];
    setRows(next);
    emit(next);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, idx) => idx !== i);
    setRows(next);
    emit(next);
  };

  return (
    <div className="space-y-1.5 rounded-md border border-input bg-surface/60 p-2" id={id}>
      {rows.length === 0 ? (
        <p className="px-1 py-1.5 text-[11px] text-muted-foreground">No entries yet.</p>
      ) : (
        rows.map((row, i) => (
          <div key={i} className="flex items-end gap-1.5">
            {subFields.map((f) => (
              <div key={f.name} className="flex flex-1 flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground">{f.label}</label>
                <input
                  type={f.type === "number" || f.type === "decimal" ? "number" : "text"}
                  step={f.type === "decimal" ? "any" : undefined}
                  value={row[f.name] ?? ""}
                  onChange={(e) => setCell(i, f.name, e.target.value)}
                  className={cn(inputClass, "h-8 text-[12px]")}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        + Add row
      </button>
    </div>
  );
}
