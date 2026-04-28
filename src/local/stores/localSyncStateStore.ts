import type { DB } from "../database.js";

export interface SyncState {
  scope: string;
  cursor?: string;
  lastSyncedAt?: string;
  metadata?: Record<string, unknown>;
}

export class LocalSyncStateStore {
  constructor(private readonly db: DB) {}

  get(scope: string): SyncState | null {
    const row = this.db.prepare(
      "SELECT * FROM sync_state WHERE scope = @scope",
    ).get({ scope }) as {
      scope: string;
      cursor: string | null;
      last_synced_at: string | null;
      metadata_json: string | null;
    } | undefined;

    if (!row) return null;
    return {
      scope: row.scope,
      cursor: row.cursor ?? undefined,
      lastSyncedAt: row.last_synced_at ?? undefined,
      metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
    };
  }

  set(scope: string, cursor?: string, metadata?: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO sync_state (scope, cursor, last_synced_at, metadata_json)
      VALUES (@scope, @cursor, @last_synced_at, @metadata_json)
    `).run({
      scope,
      cursor: cursor ?? null,
      last_synced_at: new Date().toISOString(),
      metadata_json: metadata ? JSON.stringify(metadata) : null,
    });
  }

  all(): SyncState[] {
    const rows = this.db.prepare("SELECT * FROM sync_state").all() as Array<{
      scope: string;
      cursor: string | null;
      last_synced_at: string | null;
      metadata_json: string | null;
    }>;
    return rows.map((r) => ({
      scope: r.scope,
      cursor: r.cursor ?? undefined,
      lastSyncedAt: r.last_synced_at ?? undefined,
      metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as Record<string, unknown>) : undefined,
    }));
  }
}
