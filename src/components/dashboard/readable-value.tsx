import { formatCellValue, humanizeKey, isIdKey } from "@/lib/format";

/**
 * Renders any API value — nested objects, arrays of objects, scalars — as a
 * human-readable key/value list instead of raw JSON.
 */
export function ReadableValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === "") {
    return <p className="num text-sm text-muted-foreground">—</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="num text-sm text-muted-foreground">—</p>;
    const scalars = value.every((item) => !item || typeof item !== "object");
    if (scalars) {
      return <p className="text-sm">{value.map((item) => formatCellValue(item)).join(" · ")}</p>;
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="label-eyebrow mb-1">#{index + 1}</p>
            <ReadableValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <p className="num text-sm text-muted-foreground">—</p>;
    return (
      <div className="space-y-1.5">
        {entries.map(([key, child]) =>
          child && typeof child === "object" && !Array.isArray(child) ? (
            <div key={key} className="space-y-1">
              <p className="label-eyebrow">{humanizeKey(key)}</p>
              <div className="pl-2">
                <ReadableValue value={child} depth={depth + 1} />
              </div>
            </div>
          ) : Array.isArray(child) && child.some((item) => item && typeof item === "object") ? (
            <div key={key} className="space-y-1">
              <p className="label-eyebrow">{humanizeKey(key)}</p>
              <div className="pl-2">
                <ReadableValue value={child} depth={depth + 1} />
              </div>
            </div>
          ) : (
            <div key={key} className="flex items-baseline justify-between gap-3">
              <span className="label-eyebrow">{humanizeKey(key)}</span>
              <span className="num break-words text-right text-sm">
                {formatCellValue(child, { useGrouping: !isIdKey(key) })}
              </span>
            </div>
          ),
        )}
      </div>
    );
  }
  return <p className="num break-words text-sm">{formatCellValue(value)}</p>;
}
