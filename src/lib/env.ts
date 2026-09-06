// Helper utilities to read paired env values where the first item
// is the staging value and the second is the production value.
export function pickEnvPairRaw(name: string): unknown {
  // access dynamically because ImportMetaEnv has a narrow type
  const raw = (import.meta.env as any)[name];
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const idx = (import.meta.env.MODE === "production") ? 1 : 0;
      return parsed[idx];
    }
  } catch {
    // not JSON — fallthrough to return raw string
  }
  return raw;
}

export function pickEnvString(name: string): string | undefined {
  const v = pickEnvPairRaw(name);
  if (v === undefined || v === null) return undefined;
  return String(v);
}

export function pickEnvArray<T = unknown>(name: string): T[] | undefined {
  const v = pickEnvPairRaw(name);
  if (Array.isArray(v)) return v as T[];
  // if it's a string that itself is JSON array, try parsing
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }
  return undefined;
}

export default { pickEnvPairRaw, pickEnvString, pickEnvArray };
