import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import BetterSqlite3 from "better-sqlite3";
import { getMemoryDir } from "../../config/paths.js";
import { detectSecrets } from "../secretDetector.js";
import type { MemoryAdapter, MemoryAdapterStatus, MemoryEntry, MemoryQueryInput, MemoryWriteResult } from "../types.js";

const MEMORY_DB_VERSION = 1;

function openDb(): BetterSqlite3.Database {
  const dir = getMemoryDir();
  mkdirSync(dir, { recursive: true });
  const db = new BetterSqlite3(join(dir, "memory.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT OR IGNORE INTO _meta VALUES ('version', '${MEMORY_DB_VERSION}');

    CREATE TABLE IF NOT EXISTS memory_entries (
      id          TEXT PRIMARY KEY,
      scope       TEXT NOT NULL,
      owner_id    TEXT NOT NULL,
      kind        TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT,
      source      TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT,
      expires_at  TEXT,
      blocked     INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_memory_scope_owner ON memory_entries (scope, owner_id);
    CREATE INDEX IF NOT EXISTS idx_memory_kind        ON memory_entries (kind);
    CREATE INDEX IF NOT EXISTS idx_memory_created     ON memory_entries (created_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
      USING fts5(id UNINDEXED, content, tags, source, content='memory_entries', content_rowid='rowid');

    CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts (rowid, id, content, tags, source)
        VALUES (new.rowid, new.id, new.content, COALESCE(new.tags,''), COALESCE(new.source,''));
    END;
    CREATE TRIGGER IF NOT EXISTS memory_fts_delete BEFORE DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts (memory_fts, rowid, id, content, tags, source)
        VALUES ('delete', old.rowid, old.id, old.content, COALESCE(old.tags,''), COALESCE(old.source,''));
    END;
  `);

  return db;
}

/**
 * SQLite memory adapter with FTS5 full-text search.
 *
 * Backed by ~/.vibly/memory/memory.sqlite
 */
export class SqliteMemoryAdapter implements MemoryAdapter {
  readonly type = "sqlite" as const;
  private db: BetterSqlite3.Database | null = null;

  private getDb(): BetterSqlite3.Database {
    if (!this.db) this.db = openDb();
    return this.db;
  }

  async write(entry: MemoryEntry): Promise<MemoryWriteResult> {
    const secrets = detectSecrets(entry.content);
    if (secrets.length > 0) {
      const names = [...new Set(secrets.map((s) => s.patternName))].join(", ");
      return { entryId: entry.id, blocked: true, blockReason: `Secret patterns detected: ${names}` };
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO memory_entries (id, scope, owner_id, kind, content, tags, source, created_at, updated_at, expires_at, blocked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        content    = excluded.content,
        tags       = excluded.tags,
        source     = excluded.source,
        updated_at = excluded.updated_at
    `).run(
      entry.id,
      entry.scope,
      entry.ownerId,
      entry.kind,
      entry.content,
      entry.tags ? JSON.stringify(entry.tags) : null,
      entry.source ?? null,
      entry.createdAt,
      now,
      entry.expiresAt ?? null,
    );

    return { entryId: entry.id, blocked: false };
  }

  async query(input: MemoryQueryInput): Promise<MemoryEntry[]> {
    const { scope, ownerId, kind, query: text, tags, limit = 50 } = input;
    const db = this.getDb();

    if (text) {
      // FTS5 path
      const rows = db.prepare(`
        SELECT e.* FROM memory_entries e
        JOIN memory_fts f ON e.rowid = f.rowid
        WHERE memory_fts MATCH ?
          AND (? IS NULL OR e.scope = ?)
          AND (? IS NULL OR e.owner_id = ?)
          AND (? IS NULL OR e.kind = ?)
          AND e.blocked = 0
          AND (e.expires_at IS NULL OR e.expires_at > datetime('now'))
        ORDER BY e.created_at DESC
        LIMIT ?
      `).all(text, scope ?? null, scope ?? null, ownerId ?? null, ownerId ?? null, kind ?? null, kind ?? null, limit) as Record<string, unknown>[];
      return rows.map(rowToEntry);
    }

    const rows = db.prepare(`
      SELECT * FROM memory_entries
      WHERE (? IS NULL OR scope = ?)
        AND (? IS NULL OR owner_id = ?)
        AND (? IS NULL OR kind = ?)
        AND blocked = 0
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT ?
    `).all(scope ?? null, scope ?? null, ownerId ?? null, ownerId ?? null, kind ?? null, kind ?? null, limit) as Record<string, unknown>[];

    let entries = rows.map(rowToEntry);

    if (tags && tags.length > 0) {
      entries = entries.filter((e) => tags.some((t) => e.tags?.includes(t)));
    }

    return entries;
  }

  async delete(entryId: string): Promise<boolean> {
    const db = this.getDb();
    const info = db.prepare("DELETE FROM memory_entries WHERE id = ?").run(entryId);
    return info.changes > 0;
  }

  async status(): Promise<MemoryAdapterStatus> {
    try {
      const db = this.getDb();
      const row = db.prepare("SELECT COUNT(*) as count FROM memory_entries WHERE blocked = 0").get() as { count: number };
      return {
        type: this.type,
        healthy: true,
        entryCount: row.count,
        storageDir: join(getMemoryDir(), "memory.sqlite"),
      };
    } catch (e) {
      return { type: this.type, healthy: false, detail: String(e) };
    }
  }
}

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row["id"] as string,
    scope: row["scope"] as MemoryEntry["scope"],
    ownerId: row["owner_id"] as string,
    kind: row["kind"] as MemoryEntry["kind"],
    content: row["content"] as string,
    tags: row["tags"] ? JSON.parse(row["tags"] as string) as string[] : undefined,
    source: row["source"] as string | undefined,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string | undefined,
    expiresAt: row["expires_at"] as string | undefined,
    blocked: Boolean(row["blocked"]),
  };
}

export const sqliteMemoryAdapter = new SqliteMemoryAdapter();
