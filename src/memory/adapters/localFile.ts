import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { getMemoryScopeDir } from "../../config/paths.js";
import { hasSecrets, detectSecrets } from "../secretDetector.js";
import type { MemoryAdapter, MemoryAdapterStatus, MemoryEntry, MemoryQueryInput, MemoryWriteResult } from "../types.js";

/**
 * Local-File memory adapter.
 *
 * Each entry is stored as `<id>.json` under
 *   ~/.vibly/memory/<scope>/<ownerId>/
 *
 * Queries perform a linear scan; suitable for small private memories
 * (hundreds of entries). For larger corpora use the SQLite adapter.
 */
export class LocalFileMemoryAdapter implements MemoryAdapter {
  readonly type = "local-file" as const;

  private entryPath(scope: string, ownerId: string, entryId: string): string {
    return join(getMemoryScopeDir(scope, ownerId), `${entryId}.json`);
  }

  private scopeDir(scope: string, ownerId: string): string {
    return getMemoryScopeDir(scope, ownerId);
  }

  async write(entry: MemoryEntry): Promise<MemoryWriteResult> {
    // Secret detection gate
    const secrets = detectSecrets(entry.content);
    if (secrets.length > 0) {
      const names = [...new Set(secrets.map((s) => s.patternName))].join(", ");
      return {
        entryId: entry.id,
        blocked: true,
        blockReason: `Secret patterns detected: ${names}`,
      };
    }

    const dir = this.scopeDir(entry.scope, entry.ownerId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.entryPath(entry.scope, entry.ownerId, entry.id), JSON.stringify(entry, null, 2), "utf8");

    return { entryId: entry.id, blocked: false };
  }

  async query(input: MemoryQueryInput): Promise<MemoryEntry[]> {
    const { scope, ownerId, kind, query: text, tags, limit = 50 } = input;

    if (!scope || !ownerId) return [];

    const dir = this.scopeDir(scope, ownerId);
    if (!existsSync(dir)) return [];

    const entries: MemoryEntry[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as MemoryEntry;
        // Filter
        if (kind && raw.kind !== kind) continue;
        if (text && !raw.content.toLowerCase().includes(text.toLowerCase())) continue;
        if (tags && !tags.some((t) => raw.tags?.includes(t))) continue;
        entries.push(raw);
        if (entries.length >= limit) break;
      } catch {
        // Corrupt file — skip
      }
    }

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(entryId: string): Promise<boolean> {
    // Must scan all scope dirs to find the entry by ID
    const memoryRoot = getMemoryScopeDir("", "").replace(/[\/\\]$/, "").replace(/[^\/\\]*$/, "");
    if (!existsSync(memoryRoot)) return false;

    for (const scope of readdirSync(memoryRoot)) {
      const scopePath = join(memoryRoot, scope);
      if (!readdirSync(scopePath).length) continue;
      for (const owner of readdirSync(scopePath)) {
        const filePath = join(scopePath, owner, `${entryId}.json`);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
          return true;
        }
      }
    }
    return false;
  }

  async status(): Promise<MemoryAdapterStatus> {
    try {
      const memoryBase = getMemoryScopeDir("agent_private", "_probe_").replace(/[\/\\][^\/\\]+[\/\\][^\/\\]+$/, "");
      let entryCount = 0;
      if (existsSync(memoryBase)) {
        for (const scope of readdirSync(memoryBase)) {
          const scopePath = join(memoryBase, scope);
          try {
            for (const owner of readdirSync(scopePath)) {
              const ownerPath = join(scopePath, owner);
              try {
                entryCount += readdirSync(ownerPath).filter((f) => f.endsWith(".json")).length;
              } catch { /* skip */ }
            }
          } catch { /* skip */ }
        }
      }
      return { type: this.type, healthy: true, entryCount, storageDir: memoryBase };
    } catch (e) {
      return { type: this.type, healthy: false, detail: String(e) };
    }
  }
}

export const localFileMemoryAdapter = new LocalFileMemoryAdapter();
