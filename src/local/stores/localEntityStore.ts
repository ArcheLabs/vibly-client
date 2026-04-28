import type { DB } from "../database.js";

/** Generic key-value store for any entity by kind + id */
export class LocalEntityStore {
  constructor(private readonly db: DB) {}

  upsert(kind: string, id: string, data: unknown): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_entities (kind, id, data_json, updated_at)
      VALUES (@kind, @id, @data_json, @updated_at)
    `).run({
      kind,
      id,
      data_json: JSON.stringify(data),
      updated_at: new Date().toISOString(),
    });
  }

  upsertMany(kind: string, items: Array<{ id: string } & Record<string, unknown>>): void {
    const insert = this.db.transaction((rows: typeof items) => {
      for (const item of rows) this.upsert(kind, item.id, item);
    });
    insert(items);
  }

  get<T = unknown>(kind: string, id: string): T | null {
    const row = this.db.prepare(
      "SELECT data_json FROM local_entities WHERE kind = @kind AND id = @id",
    ).get({ kind, id }) as { data_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data_json) as T;
  }

  list<T = unknown>(kind: string): T[] {
    const rows = this.db.prepare(
      "SELECT data_json FROM local_entities WHERE kind = @kind ORDER BY updated_at DESC",
    ).all({ kind }) as Array<{ data_json: string }>;
    return rows.map((r) => JSON.parse(r.data_json) as T);
  }

  delete(kind: string, id: string): void {
    this.db.prepare(
      "DELETE FROM local_entities WHERE kind = @kind AND id = @id",
    ).run({ kind, id });
  }

  count(kind: string): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM local_entities WHERE kind = @kind",
    ).get({ kind }) as { cnt: number };
    return row.cnt;
  }
}
