import type { PageMeta } from "./types.js";

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return entries.length > 0 ? `?${entries.join("&")}` : "";
}

export function extractMeta(rawMeta: unknown): PageMeta | undefined {
  if (!rawMeta || typeof rawMeta !== "object") return undefined;
  const m = rawMeta as Record<string, unknown>;
  return {
    limit: Number(m["limit"] ?? 50),
    nextCursor: (m["nextCursor"] as string | null | undefined) ?? null,
    total: m["total"] !== undefined ? Number(m["total"]) : undefined,
  };
}

export async function* paginate<T>(
  fetcher: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string | null }>,
  opts?: { maxItems?: number },
): AsyncGenerator<T[]> {
  let cursor: string | undefined;
  let count = 0;
  const max = opts?.maxItems ?? Infinity;

  while (count < max) {
    const { items, nextCursor } = await fetcher(cursor);
    if (items.length === 0) break;
    yield items;
    count += items.length;
    if (!nextCursor) break;
    cursor = nextCursor;
  }
}
