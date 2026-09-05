import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";

export type IssuedCredentials = {
  operatorId?: string | number;
  appKey?: string;
  apiKey?: string;
  message?: string;
};

/** Extracts onboarding credentials from an API response, if present. */
export function extractCredentials(data: unknown): IssuedCredentials | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const payload = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const appKey = payload.app_key;
  const apiKey = payload.api_key;
  if (typeof appKey !== "string" && typeof apiKey !== "string") return null;
  return {
    operatorId: (payload.operator_id as string | number | undefined) ?? undefined,
    appKey: typeof appKey === "string" ? appKey : undefined,
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    message: typeof root.status_description === "string" ? root.status_description : undefined,
  };
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="label-eyebrow">{label}</p>
        <p className="num break-all text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success(`${label} copied`);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Could not copy to clipboard");
          }
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CredentialsBanner({
  credentials,
  onDismiss,
}: {
  credentials: IssuedCredentials;
  onDismiss: () => void;
}) {
  return (
    <div className="panel space-y-3 border-primary/40 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{credentials.message ?? "Client onboarded successfully"}</p>
          <p className="text-xs text-muted-foreground">
            Copy these keys now — they are shown only once.
            {credentials.operatorId !== undefined ? ` Operator ID: ${credentials.operatorId}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md border border-border p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-2">
        {credentials.appKey ? <CopyRow label="App key" value={credentials.appKey} /> : null}
        {credentials.apiKey ? <CopyRow label="API key" value={credentials.apiKey} /> : null}
      </div>
    </div>
  );
}
