import { ImageOff } from "lucide-react";
import type { Dict } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  "1": "Active",
  "2": "Revoked",
  "3": "Inactive",
  "0": "Inactive",
  active: "Active",
  inactive: "Inactive",
  true: "Active",
  false: "Inactive",
  yes: "Active",
  no: "Inactive",
};

export function StatusCell({ row }: { row: Dict }) {
  const raw = row.status;
  const key = raw === null || raw === undefined ? "" : String(raw).trim().toLowerCase();
  const label = STATUS_LABELS[key] ?? (key ? raw : "—");
  const active = ["1", "active", "true", "yes"].includes(key);
  const inactive = ["0", "2", "3", "inactive", "false", "no"].includes(key);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        active && "border-success/40 bg-success/10 text-success",
        inactive && "border-destructive/40 bg-destructive/10 text-destructive",
        !active && !inactive && "border-border-strong bg-muted/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function FreebetStatusCell({ row }: { row: Dict }) {
  const raw = row.status;
  const key = raw === null || raw === undefined ? "" : String(raw).trim().toLowerCase();
  const active = ["1", "active", "true", "yes"].includes(key);
  const inactive = ["0", "3", "inactive", "false", "no"].includes(key);
  const label = STATUS_LABELS[key] ?? (key ? String(raw) : "—");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        active && "border-success/40 bg-success/10 text-success",
        inactive && "border-destructive/40 bg-destructive/10 text-destructive",
        !active && !inactive && "border-border-strong bg-muted/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function LocationCell({ row }: { row: Dict }) {
  const country = typeof row.country === "string" ? row.country.trim() : "";
  const address = typeof row.location_address === "string" ? row.location_address.trim() : "";
  const text = [country, address].filter(Boolean).join("/");
  return (
    <span className="block max-w-[18rem] truncate" title={text}>
      {text || "—"}
    </span>
  );
}

const IMAGE_KEYS = [
  "thumbnail",
  "thumbnail_url",
  "image",
  "image_url",
  "icon",
  "icon_url",
  "banner",
  "banner_url",
  "logo",
];

export function ThumbnailCell({ row }: { row: Dict }) {
  let src = "";
  for (const key of IMAGE_KEYS) {
    const value = row[key];
    if (typeof value === "string" && /^(https?:)?\/\//.test(value.trim())) {
      src = value.trim();
      break;
    }
  }
  const alt = typeof row.name === "string" ? row.name : "Game thumbnail";
  if (!src) {
    return (
      <span className="flex size-10 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
        <ImageOff className="size-4" strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="size-10 rounded-md border border-border object-cover"
    />
  );
}

export function ExchangeRateCell({ row }: { row: Dict }) {
  const raw = row.exchange_rate;
  if (raw === null || raw === undefined || raw === "") return <span>—</span>;
  const code = typeof row.currency === "string" ? row.currency.toUpperCase() : "";
  return (
    <span className="num" title={code ? `1 ${code} = ${raw} USD` : `${raw} USD`}>
      {String(raw)}
    </span>
  );
}

export function CallbackVersionCell({ row }: { row: Dict }) {
  const raw = row.callback_version;
  if (raw === null || raw === undefined || raw === "") return <span>—</span>;
  const key = String(raw).trim().toLowerCase().replace(/^v/, "");
  const label = `v${key}`;
  const isV1 = key === "1";
  const isV2 = key === "2";
  return (
    <span
      className={cn(
        "num inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
        isV1 && "border-primary/40 bg-primary/10 text-primary",
        isV2 && "border-warning/40 bg-warning/10 text-warning",
        !isV1 && !isV2 && "border-border-strong bg-muted/50 text-muted-foreground",
      )}
    >
      {isV1 || isV2 ? label : String(raw)}
    </span>
  );
}

const TRANSACTION_TYPES: Record<string, { label: string; credit: boolean }> = {
  "1": { label: "Credit", credit: true },
  "2": { label: "Debit", credit: false },
};

const TRANSACTION_TYPE_KEYS = ["transaction_type_id", "transaction_type", "type_id", "type"];

export function TransactionTypeCell({ row }: { row: Dict }) {
  let key = "";
  for (const candidate of TRANSACTION_TYPE_KEYS) {
    const value = row[candidate];
    if (value !== null && value !== undefined && value !== "") {
      key = String(value);
      break;
    }
  }
  const entry = TRANSACTION_TYPES[key];
  if (!entry) return <span>{key || "—"}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        entry.credit
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {entry.label}
    </span>
  );
}

const AMOUNT_ALIASES: Record<string, string[]> = {
  stake: ["stake", "bet_amount", "stake_amount", "amount", "stakeAmount"],
  won_amount: [
    "settlement_amount",
    "won_amount",
    "win_amount",
    "winning_amount",
    "winnings",
    "payout",
    "wonAmount",
  ],
};

/** Amount rendered with its row currency, e.g. "KES 20". */
export function MoneyCell({ row, field }: { row: Dict; field: "stake" | "won_amount" }) {
  let value: unknown;
  for (const key of AMOUNT_ALIASES[field]) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      value = row[key];
      break;
    }
  }
  if (value === undefined) return <span className="text-muted-foreground">—</span>;
  const numeric = typeof value === "number" ? value : Number(value);
  const amount = Number.isFinite(numeric)
    ? numeric.toLocaleString("en-GB", {
        minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : String(value);
  const currency = typeof row.currency === "string" ? row.currency.toUpperCase() : "";
  return <span className="num">{currency ? `${currency} ${amount}` : amount}</span>;
}
