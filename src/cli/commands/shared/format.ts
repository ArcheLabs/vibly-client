/**
 * Loose-typed object access helper used by many CLI commands.
 *
 * Several command files redundantly defined this same helper to coerce
 * arbitrary JSON-like API payloads into a record shape before reading
 * fields. Centralising avoids drift in the coercion semantics.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
