import type { DB } from "../database.js";
import type { QueueItem, QueueKind } from "../../domain/clientTypes.js";

export class LocalQueueStore {
  constructor(private readonly db: DB) {}

  upsert(item: QueueItem): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_queue_items (id, kind, status, payload_json, assigned_at, deadline, updated_at)
      VALUES (@id, @kind, @status, @payload_json, @assigned_at, @deadline, @updated_at)
    `).run({
      id: item.id,
      kind: item.kind,
      status: item.status,
      payload_json: JSON.stringify(item.payload),
      assigned_at: item.assignedAt ?? null,
      deadline: item.deadline ?? null,
      updated_at: item.updatedAt,
    });
  }

  upsertMany(items: QueueItem[]): void {
    const insert = this.db.transaction((rows: QueueItem[]) => {
      for (const item of rows) this.upsert(item);
    });
    insert(items);
  }

  listByKind<T = unknown>(kind: QueueKind, status?: string): QueueItem<T>[] {
    const rows = status
      ? this.db.prepare(
          "SELECT * FROM local_queue_items WHERE kind = @kind AND status = @status ORDER BY assigned_at ASC",
        ).all({ kind, status })
      : this.db.prepare(
          "SELECT * FROM local_queue_items WHERE kind = @kind ORDER BY assigned_at ASC",
        ).all({ kind });
    return (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r["id"] as string,
      kind: r["kind"] as QueueKind,
      status: r["status"] as QueueItem["status"],
      payload: JSON.parse(r["payload_json"] as string) as T,
      assignedAt: r["assigned_at"] as string | undefined,
      deadline: r["deadline"] as string | undefined,
      updatedAt: r["updated_at"] as string,
    }));
  }

  updateStatus(id: string, status: QueueItem["status"]): void {
    this.db.prepare(
      "UPDATE local_queue_items SET status = @status, updated_at = @updated_at WHERE id = @id",
    ).run({ id, status, updated_at: new Date().toISOString() });
  }

  get<T = unknown>(id: string): QueueItem<T> | null {
    const r = this.db.prepare(
      "SELECT * FROM local_queue_items WHERE id = @id",
    ).get({ id }) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: r["id"] as string,
      kind: r["kind"] as QueueKind,
      status: r["status"] as QueueItem["status"],
      payload: JSON.parse(r["payload_json"] as string) as T,
      assignedAt: r["assigned_at"] as string | undefined,
      deadline: r["deadline"] as string | undefined,
      updatedAt: r["updated_at"] as string,
    };
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM local_queue_items WHERE id = @id").run({ id });
  }

  countByKind(kind: QueueKind, status?: string): number {
    const row = status
      ? this.db.prepare(
          "SELECT COUNT(*) as cnt FROM local_queue_items WHERE kind = @kind AND status = @status",
        ).get({ kind, status })
      : this.db.prepare(
          "SELECT COUNT(*) as cnt FROM local_queue_items WHERE kind = @kind",
        ).get({ kind });
    return (row as { cnt: number }).cnt;
  }
}
