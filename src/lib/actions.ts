/**
 * Write-side catalogue: every POST / PATCH / DELETE endpoint exposed by the
 * backoffice API, described declaratively so one dialog can render them all.
 */

import { COUNTRY_OPTIONS } from "./utils/countries";
import { CURRENCY_OPTIONS } from "./utils/currencies";

export type ActionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "decimal"
  | "date"
  | "datetime"
  | "select"
  | "boolean"
  | "json"
  | "file"
  | "operator"
  | "operators-multi"
  | "game"
  | "permission"
  | "permissions-multi"
  | "role"
  | "partner"
  | "currency"
  | "currency-multi"
  | "money"
  | "object"
  | "object-array"
  | "color";


export type ActionField = {
  name: string;
  label: string;
  type: ActionFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
  /** Send as a query-string param instead of in the request body. */
  inQuery?: boolean;
  /**
   * When set, this field is grouped with sibling fields sharing the same
   * arrayKey into a single object, then wrapped as `{ [arrayKey]: [obj] }`
   * on the request body. Enables friendly UIs for endpoints that expect
   * `clients: [{ operator_id, access_level }]`-style shapes.
   */
  arrayKey?: string;
  /** Name of another field in the same form this field depends on (e.g. currency depends on operator_id). */
  dependsOn?: string;
  /** Group row-based reference options by this field key. */
  groupBy?: string;
  /** Load options from the global game catalogue (GET /api/v1/games). */
  catalog?: boolean;
  /** Adds the env-driven "Top games" group option to a partner dropdown. */
  topGroup?: boolean;
  /** Render the field as read-only (value shown but not editable). */
  readOnly?: boolean;
  /** Subfields for `object` and `object-array` composite types. */
  subFields?: ActionField[];
};


export type ActionDef = {
  key: string;
  label: string;
  description?: string;
  method: "POST" | "PATCH" | "DELETE";
  /** `collection` = toolbar button, `row` = per-record button. */
  scope: "collection" | "row";
  /** `{id}` is replaced with the row value at `idKey`. */
  path: string;
  idKey?: string;
  encoding?: "json" | "multipart";
  fields?: ActionField[];
  danger?: boolean;
  /** Row keys copied into the form when opening a row action. */
  prefill?: string[];
  /**
   * When set, wrap the listed body fields into an array under `wrapAs.key`.
   * Used e.g. by `POST /users/{id}/permissions` which expects
   * `{ permissions: [{ permission_id, effect, reason }] }`.
   */
  wrapAs?: { key: string; fields: string[] };
  /** Permission(s) required to see this action button. */
  permission?: string | string[];
  /**
   * Account types allowed to run this action (matched against `user_type`).
   * Used for endpoints the API restricts, e.g. CLIENT_ADMIN-only actions.
   */
  roles?: string[];
  /**
   * Skip the parameter modal: every param is taken from the current filter bar,
   * so we only ask for a confirmation before firing the request.
   */
  confirmFromFilters?: boolean;
  /**
   * Extra query params sent with a confirm-only action, mapping the query key
   * to the row column it is read from (e.g. `{ bet_id: "id" }`).
   */
  queryFromRow?: Record<string, string>;
};

const statusField = (required = false): ActionField => ({
  name: "status",
  label: "Status",
  type: "select",
  required,
  options: [
    { label: "—", value: "" },
    { label: "Active (1)", value: "1" },
    { label: "Inactive (3)", value: "3" },
  ],
});

const operatorField = (required = true, name = "operator_id"): ActionField => ({
  name,
  label: "Operator / client",
  type: "operator",
  required,
});

const partnerField = (required = false, name = "partner_id"): ActionField => ({
  name,
  label: "Partner group",
  type: "partner",
  required,
});

const gameField = (required = true, name = "game_id"): ActionField => ({
  name,
  label: "Game",
  type: "game",
  required,
});
const CLIENT_FIELD_NAMES = [
  "name",
  "email",
  "location_address",
  "country",
  "default_currency",
  "currency_list",
  "callback_version",
  "callback_url",
  "home_url",
  "topup_url",
  "login_url",
  "url_type",
];

const clientFields = (required: boolean): ActionField[] => [
  { name: "name", label: "Name", type: "text", required },
  { name: "email", label: "Email", type: "text", required },
  { name: "location_address", label: "Address", type: "text", required },
  { name: "country", label: "Country", type: "select", required, options: COUNTRY_OPTIONS },
  {
    name: "default_currency",
    label: "Default currency",
    type: "select",
    required,
    options: CURRENCY_OPTIONS,
  },
  {
    name: "currency_list",
    label: "Currency list",
    type: "currency-multi",
    required,
    placeholder: "Select currencies",
  },
  {
    name: "callback_version",
    label: "Callback version",
    type: "select",
    required,
    options: [
      { label: "v1", value: "v1" },
      { label: "v2", value: "v2" },
    ],
  },
  { name: "callback_url", label: "Callback URL", type: "text", required },
  { name: "home_url", label: "Home URL", type: "text" },
  { name: "topup_url", label: "Top-up URL", type: "text" },
  { name: "login_url", label: "Login URL", type: "text" },
  {
    name: "url_type",
    label: "URL type",
    type: "select",
    options: [
      { label: "Redirect to Top Up URL", value: "1" },
      { label: "Send a window postMessage", value: "2" },
    ],

  },
];

export const ACTIONS: Record<string, ActionDef[]> = {
  bets: [
    {
      key: "bets-bulk-posting",
      label: "Bulk request posting",
      description: "PATCH /api/v1/bets/request-posting/bulk — queue bets for posting. All times are in UTC.",
      method: "PATCH",
      scope: "collection",
      path: "/api/v1/bets/request-posting/bulk",
      confirmFromFilters: true,
      fields: [
        { ...operatorField(false), inQuery: true },
        { ...gameField(false), inQuery: true },
        { name: "date_from", label: "Date from (UTC)", type: "datetime", required: true, inQuery: true },
        { name: "date_to", label: "Date to (UTC)", type: "datetime", required: true, inQuery: true },
      ],

    },
    {
      key: "bet-request-posting",
      label: "Request posting",
      description: "PATCH /api/v1/bets/{id}/request-posting — queue a single bet for posting. game_id is required; operator_id is required for multi-client admins. All times are in UTC.",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/bets/{id}/request-posting",
      idKey: "id",
      confirmFromFilters: true,
      fields: [
        { ...operatorField(false), inQuery: true },
        { ...gameField(true), inQuery: true },
      ],

    },
  ],

  clients: [
    {
      key: "client-create",
      label: "Onboard client",
      description: "POST /api/v1/clients",
      method: "POST",
      scope: "collection",
      path: "/api/v1/clients",
      fields: clientFields(true),
    },
    {
      key: "client-update",
      label: "Edit client",
      description: "PATCH /api/v1/clients/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/clients/{id}",
      idKey: "id",
      prefill: ["location_address", "country", "status"],
      fields: [
        { name: "location_address", label: "Address", type: "text" },
        { name: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
        statusField(),
      ],
    },
    {
      key: "client-settings",
      label: "Edit settings",
      description: "PATCH /api/v1/clients/{id}/settings",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/clients/{id}/settings",
      idKey: "id",
      prefill: CLIENT_FIELD_NAMES,
      fields: clientFields(false),
    },
    {
      key: "client-regenerate-key-self",
      label: "Regenerate API key",
      description:
        "POST /api/v1/clients/regenerate-api-key — CLIENT_ADMIN only. Single-client admins are resolved from the session; multi-client admins pick the client.",
      method: "POST",
      scope: "collection",
      path: "/api/v1/clients/regenerate-api-key",
      danger: true,
      fields: [
        {
          ...operatorField(false),
          help: "Required when your account administers more than one client.",
        },
      ],
      roles: ["CLIENT_ADMIN"],
    },
  ],


  games: [
    {
      key: "game-create",
      label: "Create game",
      description: "POST /api/v1/games — multipart, backoffice games use partner_id=0.",
      method: "POST",
      scope: "collection",
      path: "/api/v1/games",
      encoding: "multipart",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "live_url", label: "Live URL", type: "text", required: true },
        { name: "demo_url", label: "Demo URL", type: "text", required: true },
        { name: "thumbnail", label: "Thumbnail image", type: "file", required: true },
        { name: "logo", label: "Logo image", type: "file" },
        { name: "category_id", label: "Category ID", type: "number" },
        { name: "partner_game_id", label: "Partner game ID", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "expected_rtp", label: "Expected RTP", type: "text" },
        { name: "extra_data", label: "Extra data", type: "json" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "1" },
            { label: "Deactivate", value: "3" },
          ],
        },
      ],
    },
    {
      key: "game-update",
      label: "Edit game",
      description: "POST /api/v1/games/{id} — only supplied fields change.",
      method: "POST",
      scope: "row",
      path: "/api/v1/games/{id}",
      idKey: "id",
      encoding: "multipart",
      prefill: [
        "name",
        "live_url",
        "demo_url",
        "description",
        "expected_rtp",
        "status",
        "category_id",
        "partner_game_id",
        "extra_data",
      ],
      fields: [
        { name: "name", label: "Name", type: "text" },
        { name: "live_url", label: "Live URL", type: "text" },
        { name: "demo_url", label: "Demo URL", type: "text" },
        { name: "thumbnail", label: "Thumbnail image", type: "file" },
        { name: "logo", label: "Logo image", type: "file" },
        { name: "category_id", label: "Category ID", type: "number" },
        { name: "partner_game_id", label: "Partner game ID", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "expected_rtp", label: "Expected RTP", type: "text" },
        { name: "extra_data", label: "Extra data", type: "json" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "1" },
            { label: "Deactivate", value: "3" },
          ],
        },
      ],
    },
  ],

  "operator-games": [
    {
      key: "operator-game-create",
      label: "Add operator game",
      description: "POST /api/v1/operator-games",
      method: "POST",
      scope: "collection",
      path: "/api/v1/operator-games",
      fields: [
        operatorField(),
        { ...partnerField(false), topGroup: true },
        { ...gameField(false), label: "Or select individual game", groupBy: "partner_name", catalog: true },
        { name: "game_name", label: "Display name", type: "text" },
        { name: "minimum_stake", label: "Minimum stake (per currency)", type: "money", required: true, dependsOn: "operator_id" },
        { name: "maximum_stake", label: "Maximum stake (per currency)", type: "money", required: true, dependsOn: "operator_id" },
        { name: "maximum_win", label: "Maximum win (per currency)", type: "money", required: true, dependsOn: "operator_id" },
        { name: "denomination", label: "Denomination (per currency)", type: "object", dependsOn: "operator_id" },
        { name: "total_games", label: "Total games", type: "number" },


      ],
    },
    {
      key: "operator-game-update",
      label: "Edit operator game",
      description: "POST /api/v1/operator-games/{id}",
      method: "POST",
      scope: "row",
      path: "/api/v1/operator-games/{id}",
      idKey: "id",
      encoding: "multipart",
      prefill: ["game_id", "game_name", "total_games", "priority", "status", "stake", "payout", "denomination"],
      fields: [
        { name: "game_id", label: "Game", type: "game" },
        { name: "game_name", label: "Display name", type: "text" },
        { name: "minimum_stake", label: "Minimum stake (per currency)", type: "money" },
        { name: "maximum_stake", label: "Maximum stake (per currency)", type: "money" },
        { name: "maximum_win", label: "Maximum win (per currency)", type: "money" },
        {
          name: "apply_limits_to_all_operator_games",
          label: "Apply limits to all games for this operator",
          type: "boolean",
        },
        { name: "denomination", label: "Denomination (per currency)", type: "object" },
        { name: "stake", label: "Stake (per currency)", type: "money" },
        { name: "payout", label: "Payout (per currency)", type: "money" },


        { name: "color_scheme", label: "Colour scheme", type: "color" },
        { name: "logo", label: "Logo image", type: "file" },
        { name: "thumbnail", label: "Thumbnail image", type: "file" },
        { name: "background_image", label: "Background image", type: "file" },
        { name: "priority", label: "Priority", type: "number" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active (1)", value: "1" },
            { label: "Inactive (3)", value: "3" },
          ],
        },
      ],
    },
  ],

  partners: [
    {
      key: "partner-create",
      label: "Create partner",
      description: "POST /api/v1/partners",
      method: "POST",
      scope: "collection",
      path: "/api/v1/partners",
      encoding: "multipart",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        {
          name: "launch_type",
          label: "Launch type",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "call", value: "call" },
            { label: "formulate", value: "formulate" },
          ],
        },
        { name: "launch_template", label: "Launch template", type: "textarea" },
        { name: "launch_api", label: "Launch API", type: "text" },
        { name: "configs", label: "Configs", type: "json" },
        { name: "thumbnail", label: "Thumbnail image", type: "file" },
      ],
    },
    {
      key: "partner-update",
      label: "Edit partner",
      description: "PATCH /api/v1/partners/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/partners/{id}",
      idKey: "id",
      encoding: "multipart",
      prefill: ["name", "launch_type", "launch_api", "status"],
      fields: [
        { name: "name", label: "Name", type: "text" },
        statusField(),
        {
          name: "launch_type",
          label: "Launch type",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "call", value: "call" },
            { label: "formulate", value: "formulate" },
          ],
        },
        { name: "launch_template", label: "Launch template", type: "textarea" },
        { name: "launch_api", label: "Launch API", type: "text" },
        { name: "configs", label: "Configs", type: "json" },
        { name: "thumbnail", label: "Thumbnail image", type: "file" },
        { name: "logo", label: "Logo image", type: "file" },
      ],
    },
  ],

  permissions: [
    {
      key: "permission-create",
      label: "Create permission",
      description: "POST /api/v1/permissions",
      method: "POST",
      scope: "collection",
      path: "/api/v1/permissions",
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "slug", label: "Slug", type: "text", required: true },
        { name: "group_name", label: "Group", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "http_method", label: "HTTP method", type: "text", placeholder: "GET" },
        { name: "api_pattern", label: "API pattern", type: "text", placeholder: "/api/v1/bets*" },
      ],
    },
  ],

  blacklist: [
    {
      key: "blacklist-create",
      label: "Blacklist profile",
      description: "POST /api/v1/profile-blacklist",
      method: "POST",
      scope: "collection",
      path: "/api/v1/profile-blacklist",
      fields: [
        { name: "blacklist_reason", label: "Reason", type: "textarea", required: true },
        { name: "profile_id", label: "Profile ID", type: "number" },
        operatorField(false),
        { name: "player_id", label: "Operator player ID", type: "text" },
      ],
    },
    {
      key: "blacklist-update",
      label: "Edit",
      description: "PATCH /api/v1/profile-blacklist/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/profile-blacklist/{id}",
      idKey: "id",
      prefill: ["blacklist_reason", "status"],
      fields: [{ name: "blacklist_reason", label: "Reason", type: "textarea" }, statusField()],
    },
    {
      key: "blacklist-delete",
      label: "Remove",
      description: "DELETE /api/v1/profile-blacklist/{id}",
      method: "DELETE",
      scope: "row",
      path: "/api/v1/profile-blacklist/{id}",
      idKey: "id",
      danger: true,
    },
  ],

  whitelist: [
    {
      key: "whitelist-create",
      label: "Add IP",
      description: "POST /api/v1/operator-api-whitelist",
      method: "POST",
      scope: "collection",
      path: "/api/v1/operator-api-whitelist",
      fields: [
        operatorField(),
        { name: "ip_address", label: "IP address", type: "text", required: true, placeholder: "203.0.113.10" },
        {
          name: "api_scope",
          label: "API scope",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "FREEBET", value: "FREEBET" },
          ],
        },
        { name: "description", label: "Description", type: "text" },
        statusField(),
      ],
    },
    {
      key: "whitelist-update",
      label: "Edit",
      description: "PATCH /api/v1/operator-api-whitelist/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/operator-api-whitelist/{id}",
      idKey: "id",
      prefill: ["api_scope", "ip_address", "description", "status"],
      fields: [
        {
          name: "api_scope",
          label: "API scope",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "FREEBET", value: "FREEBET" },
          ],
        },
        { name: "ip_address", label: "IP address", type: "text" },
        { name: "description", label: "Description", type: "text" },
        statusField(),
      ],
    },
    {
      key: "whitelist-delete",
      label: "Deactivate",
      description: "DELETE /api/v1/operator-api-whitelist/{id}",
      method: "DELETE",
      scope: "row",
      path: "/api/v1/operator-api-whitelist/{id}",
      idKey: "id",
      danger: true,
    },
  ],

  "bonus-config": [
    {
      key: "bonus-config-create",
      label: "Create bonus config",
      description: "POST /api/v1/promotions/bonus-config",
      method: "POST",
      scope: "collection",
      path: "/api/v1/promotions/bonus-config",
      fields: [
        gameField(),
        operatorField(),
        { name: "name", label: "Name", type: "text", required: true },
        {
          name: "config",
          label: "Config",
          type: "object",
          subFields: [
            { name: "min_odds", label: "Min odds", type: "decimal" },
            { name: "max_odds", label: "Max odds", type: "decimal" },
            { name: "total_max_odds", label: "Total max odds", type: "decimal" },
            { name: "min_stake", label: "Min stake", type: "decimal" },
            { name: "max_stake", label: "Max stake", type: "decimal" },
            { name: "max_amount", label: "Max amount", type: "decimal" },
          ],
        },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "end_date", label: "End date", type: "date", required: true },
      ],
    },
    {
      key: "bonus-config-update",
      label: "Edit",
      description: "PATCH /api/v1/promotions/bonus-config/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/promotions/bonus-config/{id}",
      idKey: "id",
      prefill: ["name", "config", "start_date", "end_date", "status"],
      fields: [
        { name: "name", label: "Name", type: "text" },
        {
          name: "config",
          label: "Config",
          type: "object",
          subFields: [
            { name: "min_odds", label: "Min odds", type: "decimal" },
            { name: "max_odds", label: "Max odds", type: "decimal" },
            { name: "total_max_odds", label: "Total max odds", type: "decimal" },
            { name: "min_stake", label: "Min stake", type: "decimal" },
            { name: "max_stake", label: "Max stake", type: "decimal" },
            { name: "max_amount", label: "Max amount", type: "decimal" },
          ],
        },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
        { name: "status", label: "Status", type: "number" },
      ],
    },
  ],

  "freebet-config": [
    {
      key: "freebet-config-create",
      label: "Create freebet config",
      description: "POST /api/v1/promotions/freebet-config",
      method: "POST",
      scope: "collection",
      path: "/api/v1/promotions/freebet-config",
      fields: [
        operatorField(),
        gameField(),
        { name: "name", label: "Name", type: "text", required: true },
        { name: "min_stake", label: "Min stake (per currency)", type: "money", required: true, dependsOn: "operator_id" },
        { name: "amount", label: "Amount (per currency)", type: "money", required: true, dependsOn: "operator_id" },
        { name: "min_bet_count", label: "Min bet count", type: "number", required: true },
        { name: "min_slip_odds", label: "Min slip odds", type: "decimal", required: true },
        { name: "min_total_odds", label: "Min total odds", type: "decimal", required: true },
        { name: "min_slip_count", label: "Min slip count", type: "number" },
        {
          name: "duration_type",
          label: "Duration type",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "day", value: "day" },
            { label: "week", value: "week" },
            { label: "month", value: "month" },
          ],
        },
        { name: "frequency", label: "Frequency", type: "number" },
        { name: "cumulative_stake", label: "Cumulative stake (per currency)", type: "money", dependsOn: "operator_id" },
        { name: "expiry", label: "Expiry (days)", type: "number" },
        {
          name: "config",
          label: "Config",
          type: "object",
          subFields: [],
        },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "end_date", label: "End date", type: "date", required: true },
        { name: "status", label: "Status", type: "number" },
      ],
    },
    {
      key: "freebet-config-update",
      label: "Edit",
      description: "PATCH /api/v1/promotions/freebet-config/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/promotions/freebet-config/{id}",
      idKey: "id",
      prefill: ["name", "min_stake", "amount", "cumulative_stake", "config", "min_bet_count", "min_slip_count", "min_slip_odds", "min_total_odds", "duration_type", "frequency", "expiry", "start_date", "end_date", "status"],
      fields: [
        { name: "name", label: "Name", type: "text" },
        { name: "min_stake", label: "Min stake (per currency)", type: "money" },
        { name: "amount", label: "Amount (per currency)", type: "money" },
        { name: "min_bet_count", label: "Min bet count", type: "number" },
        { name: "min_slip_count", label: "Min slip count", type: "number" },
        { name: "min_slip_odds", label: "Min slip odds", type: "decimal" },
        { name: "min_total_odds", label: "Min total odds", type: "decimal" },
        {
          name: "duration_type",
          label: "Duration type",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "day", value: "day" },
            { label: "week", value: "week" },
            { label: "month", value: "month" },
          ],
        },
        { name: "frequency", label: "Frequency", type: "number" },
        { name: "cumulative_stake", label: "Cumulative stake (per currency)", type: "money" },
        { name: "expiry", label: "Expiry (days)", type: "number" },
        {
          name: "config",
          label: "Config",
          type: "object",
          subFields: [],
        },
        { name: "start_date", label: "Start date", type: "date" },
        { name: "end_date", label: "End date", type: "date" },
        { name: "status", label: "Status", type: "number" },
      ],
    },
  ],


  "freebet-capabilities": [
    {
      key: "freebet-capability-create",
      label: "Enable game",
      description: "POST /api/v1/promotions/freebet-capabilities",
      method: "POST",
      scope: "collection",
      path: "/api/v1/promotions/freebet-capabilities",
      fields: [
        operatorField(),
        gameField(),
        {
          name: "fulfilment_type",
          label: "Fulfilment type",
          type: "select",
          required: true,
          options: [
            { label: "In house", value: "IN_HOUSE" },
            { label: "Partner API", value: "PARTNER_API" },
          ],
        },
        statusField(),
      ],
    },
    {
      key: "freebet-capability-update",
      label: "Edit",
      description: "PATCH /api/v1/promotions/freebet-capabilities/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/promotions/freebet-capabilities/{id}",
      idKey: "id",
      prefill: ["fulfilment_type", "status"],
      fields: [
        {
          name: "fulfilment_type",
          label: "Fulfilment type",
          type: "select",
          options: [
            { label: "—", value: "" },
            { label: "In house", value: "IN_HOUSE" },
            { label: "Partner API", value: "PARTNER_API" },
          ],
        },
        statusField(),
      ],
    },
  ],

  "operator-game-freebets": [
    {
      key: "operator-game-freebet-create",
      label: "Allow operator game",
      description: "POST /api/v1/promotions/operator-game-freebets",
      method: "POST",
      scope: "collection",
      path: "/api/v1/promotions/operator-game-freebets",
      fields: [operatorField(), gameField(), statusField()],
    },
    {
      key: "operator-game-freebet-update",
      label: "Set status",
      description: "PATCH /api/v1/promotions/operator-game-freebets/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/promotions/operator-game-freebets/{id}",
      idKey: "id",
      prefill: ["status"],
      fields: [statusField(true)],
    },
  ],

  "freebet-campaigns": [
    {
      key: "freebet-campaign-create",
      label: "Create campaign",
      description: "POST /api/v1/promotions/freebet-campaigns",
      method: "POST",
      scope: "collection",
      path: "/api/v1/promotions/freebet-campaigns",
      fields: [
        operatorField(),
        gameField(),
        { name: "name", label: "Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "currency", label: "Currency", type: "currency", required: true, readOnly: true, dependsOn: "operator_id", help: "Set automatically from the selected operator." },
        { name: "amount", label: "Amount", type: "decimal", required: true },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "end_date", label: "End date", type: "date", required: true },
        { name: "validity", label: "Validity (hours)", type: "number", required: true },
        { name: "max_count_per_player", label: "Max count per player", type: "number" },
        { name: "minimum_multiplier", label: "Minimum multiplier", type: "decimal" },
        { name: "deduct_stake_on_win", label: "Deduct stake on win", type: "boolean" },
        { name: "qualification_rules", label: "Qualification rules", type: "json" },
        { name: "config", label: "Config", type: "json" },
      ],
    },
    {
      key: "freebet-campaign-award",
      label: "Award freebets",
      description: "POST /api/v1/promotions/freebet-campaigns/{campaign_uuid}/awards",
      method: "POST",
      scope: "row",
      path: "/api/v1/promotions/freebet-campaigns/{id}/awards",
      idKey: "campaign_uuid",
      encoding: "multipart",
      fields: [
        {
          name: "players_json",
          label: "Players (JSON array)",
          type: "json",
          placeholder: '[{"player_id":"123","player_name":"Jane"}]',
          help: "JSON array of players — objects with player_id and player_name.",
        },
        {
          name: "players_csv",
          label: "Players CSV",
          type: "file",
          help: "Alternative to the JSON array. CSV columns: player_id, player_name.",
        },
      ],
    },
  ],

  "freebet-awards": [
    {
      key: "freebet-award-revoke",
      label: "Revoke",
      description: "POST /api/v1/promotions/freebet-awards/{freebet_uuid}/revoke",
      method: "POST",
      scope: "row",
      path: "/api/v1/promotions/freebet-awards/{id}/revoke",
      idKey: "freebet_uuid",
      danger: true,
    },
  ],

  users: [
    {
      key: "user-create",
      label: "Create user",
      description: "POST /api/v1/users — emails a temporary password.",
      method: "POST",
      scope: "collection",
      path: "/api/v1/users",
      fields: [
        { name: "email", label: "Email", type: "text", required: true },
        { name: "first_name", label: "First name", type: "text", required: true },
        { name: "last_name", label: "Last name", type: "text" },
        {
          name: "user_type",
          label: "User type",
          type: "select",
          required: true,
          options: [
            { label: "Super admin", value: "SUPER_ADMIN" },
            { label: "Admin", value: "ADMIN" },
            { label: "Client admin", value: "CLIENT_ADMIN" },
            { label: "Support", value: "SUPPORT" },
            { label: "Finance", value: "FINANCE" },
            { label: "Auditor", value: "AUDITOR" },
            { label: "Custom", value: "CUSTOM" },
          ],
        },
        { name: "role_id", label: "Role", type: "role", required: true },
        {
          name: "operator_id",
          label: "Clients / operators",
          type: "operators-multi",
          required: true,
          arrayKey: "clients",
          help: "Select one or more operators this user will manage.",
        },
        {
          name: "access_level",
          label: "Access level",
          type: "select",
          required: true,
          arrayKey: "clients",
          options: [
            { label: "Owner", value: "OWNER" },
            { label: "Admin", value: "ADMIN" },
            { label: "Viewer", value: "VIEWER" },
          ],
        },
        {
          name: "permissions",
          label: "Permissions",
          type: "permissions-multi",
          help: "Additional permissions granted directly to this user.",
        },
      ],
    },
    {
      key: "user-update",
      label: "Edit",
      description: "PATCH /api/v1/users/{id}",
      method: "PATCH",
      scope: "row",
      path: "/api/v1/users/{id}",
      idKey: "id",
      prefill: ["first_name", "last_name", "status"],
      fields: [
        { name: "first_name", label: "First name", type: "text" },
        { name: "last_name", label: "Last name", type: "text" },
        statusField(),
      ],
    },
    {
      key: "user-permissions",
      label: "Set permissions",
      description: "POST /api/v1/users/{id}/permissions",
      method: "POST",
      scope: "row",
      path: "/api/v1/users/{id}/permissions",
      idKey: "id",
      wrapAs: { key: "permissions", fields: ["permission_id", "effect", "reason"] },
      fields: [
        {
          name: "permission_id",
          label: "Permissions",
          type: "permissions-multi",
          required: true,
          help: "Select one or more permissions, or choose Select all from the dropdown.",
        },
        {
          name: "effect",
          label: "Effect",
          type: "select",
          required: true,
          options: [
            { label: "Allow", value: "ALLOW" },
            { label: "Deny", value: "DENY" },
          ],
        },
        { name: "reason", label: "Reason", type: "text", placeholder: "Optional note" },
      ],
    },
    {
      key: "user-permission-remove",
      label: "Remove permission",
      description: "DELETE /api/v1/users/{id}/permissions/{permission_id}",
      method: "DELETE",
      scope: "row",
      path: "/api/v1/users/{id}/permissions/{permission_id}",
      idKey: "id",
      danger: true,
      fields: [{ name: "permission_id", label: "Permission", type: "permission", required: true }],
    },
  ],
};

export function actionsFor(resourceKey: string, scope: "collection" | "row") {
  return (ACTIONS[resourceKey] ?? []).filter((action) => action.scope === scope);
}

/** Resolve `{id}` and any other `{placeholder}` from the row / form values. */
export function resolvePath(
  action: ActionDef,
  row: Record<string, unknown> | undefined,
  values: Record<string, unknown>,
): string {
  return action.path.replace(/\{(\w+)\}/g, (_match, token: string) => {
    if (token === "id") return String(row?.[action.idKey ?? "id"] ?? "");
    return String(values[token] ?? row?.[token] ?? "");
  });
}
