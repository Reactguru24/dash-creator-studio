import { AlertTriangle, Info } from "lucide-react";
import { ApiError, fieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Surfaces the API's error envelope as a friendly message + any field errors. */
export function ApiErrorBox({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const api = error instanceof ApiError ? error : null;
  const rawMessage = error instanceof Error ? error.message : String(error);
  // Suppress staging-network noise in production builds: the staging API
  // is intentionally unreachable from production and we don't want to show
  // that error to production users. Detect it and hide the box entirely.
  const isProd = Boolean((import.meta as any).env?.PROD);
  const suppressReachabilityError =
    isProd &&
    /(staging )?api(?: is)? (?:temporarily )?unreachable|temporarily unavailable/i.test(rawMessage);
  if (suppressReachabilityError) {
    return null;
  }

  const message = friendlyMessage(rawMessage);
  const details = (api ? fieldErrors(api.payload) : []).map(friendlyMessage);

  // Treat a few known generic messages as real errors; otherwise show a
  // neutral notice so informational responses (eg. "Password reset required")
  // don't render a destructive "Request failed" banner.
  const isInformationalNotice =
    /password reset required/i.test(message) ||
    /reset challenge/i.test(message) ||
    /challenge has been sent/i.test(message);

  const isGenericError =
    message === "Something went wrong. Please try again." ||
    message === "Something went wrong on our end. Please try again." ||
    message === "Select a client";

  const showError = !isInformationalNotice && (isGenericError || details.length > 0);

  if (showError) {
    return (
      <div className={cn("rounded-md border border-destructive/40 bg-destructive/10 p-3", className)}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">Request failed</p>
            <p className="mt-0.5 break-words text-sm text-foreground/80">{message}</p>
            {details.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {details.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Non-error informational messages: render a neutral notice box.
  return (
    <div className={cn("rounded-md border border-border bg-muted/10 p-3", className)}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Notice</p>
          <p className="mt-0.5 break-words text-sm text-foreground/80">{message}</p>
        </div>
      </div>
    </div>
  );
}

function friendlyMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return "Something went wrong. Please try again.";
  if (/operator[_ ]?id.*(required|missing)/i.test(trimmed)) return "Select a client";
  if (/^internal server error$/i.test(trimmed))
    return "Something went wrong on our end. Please try again.";
  if (/^request failed(\s*\(\d+\))?$/i.test(trimmed))
    return "Something went wrong. Please try again.";
  if (/password reset required/i.test(trimmed) || /reset challenge/i.test(trimmed))
    return trimmed;
  // Strip trailing "(500)" style status codes.
  return trimmed.replace(/\s*\(\d{3}\)\s*$/, "");
}
