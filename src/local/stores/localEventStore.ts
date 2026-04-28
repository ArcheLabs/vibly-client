import type { DB } from "../database.js";
import type { EventEnvelope } from "../../coordinator/types.js";

export interface LocalEvent {
  id: string;
  type: string;
  timestamp: string;
  actorId?: string;
  correlationId?: string;
  envelope: EventEnvelope;
  syncedAt: string;
}

export class LocalEventStore {
  constructor(private readonly db: DB) {}

  upsert(event: EventEnvelope): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO local_events
        (id, type, timestamp, actor_id, correlation_id, envelope_json, synced_at)
      VALUES
        (@id, @type, @timestamp, @actor_id, @correlation_id, @envelope_json, @synced_at)
    `);
    stmt.run({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp ?? new Date().toISOString(),
      actor_id: event.actorId ?? null,
      correlation_id: event.correlationId ?? null,
      envelope_json: JSON.stringify(event),
      synced_at: new Date().toISOString(),
    });
  }

  upsertMany(events: EventEnvelope[]): void {
    const insert = this.db.transaction((evs: EventEnvelope[]) => {
      for (const e of evs) this.upsert(e);
    });
    insert(events);
  }

  list(opts?: {
    type?: string;
    correlationId?: string;
    limit?: number;
    afterTimestamp?: string;
  }): LocalEvent[] {
    let sql = "SELECT * FROM local_events WHERE 1=1";
    const params: Record<string, unknown> = {};
    if (opts?.type) { sql += " AND type = @type"; params["type"] = opts.type; }
    if (opts?.correlationId) { sql += " AND correlation_id = @cid"; params["cid"] = opts.correlationId; }
    if (opts?.afterTimestamp) { sql += " AND timestamp > @after"; params["after"] = opts.afterTimestamp; }
    sql += " ORDER BY timestamp ASC";
    if (opts?.limit) { sql += " LIMIT @limit"; params["limit"] = opts.limit; }

    const rows = this.db.prepare(sql).all(params) as Array<{
      id: string;
      type: string;
      timestamp: string;
      actor_id: string | null;
      correlation_id: string | null;
      envelope_json: string;
      synced_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      timestamp: r.timestamp,
      actorId: r.actor_id ?? undefined,
      correlationId: r.correlation_id ?? undefined,
      envelope: JSON.parse(r.envelope_json) as EventEnvelope,
      syncedAt: r.synced_at,
    }));
  }

  getLatestTimestamp(): string | null {
    const row = this.db.prepare(
      "SELECT timestamp FROM local_events ORDER BY timestamp DESC LIMIT 1",
    ).get() as { timestamp: string } | undefined;
    return row?.timestamp ?? null;
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM local_events").get() as { cnt: number };
    return row.cnt;
  }
}
