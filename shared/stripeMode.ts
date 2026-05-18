/** Shared truthy env parsing (`true`, `1`, case-insensitive). */
export function parseTruthyEnv(v: unknown): boolean {
  return String(v || "").toLowerCase() === "true" || v === "1";
}
