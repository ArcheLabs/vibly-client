import type { DB } from "../database.js";
import type { LocalRuntimeConfig } from "../../domain/clientTypes.js";

export class LocalRuntimeStore {
  constructor(private readonly db: DB) {}

  register(config: LocalRuntimeConfig): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_runtimes
        (id, name, runtime_type, command, env_json, timeout_ms,
         capabilities_json, agent_id, runtime_binding_id, registered_at)
      VALUES
        (@id, @name, @runtime_type, @command, @env_json, @timeout_ms,
         @capabilities_json, @agent_id, @runtime_binding_id, @registered_at)
    `).run({
      id: config.id,
      name: config.name,
      runtime_type: config.runtimeType,
      command: config.command ?? null,
      env_json: config.env ? JSON.stringify(config.env) : null,
      timeout_ms: config.timeoutMs ?? null,
      capabilities_json: config.capabilities ? JSON.stringify(config.capabilities) : null,
      agent_id: config.agentId ?? null,
      runtime_binding_id: config.runtimeBindingId ?? null,
      registered_at: new Date().toISOString(),
    });
  }

  getById(id: string): LocalRuntimeConfig | null {
    return this._rowToConfig(
      this.db.prepare("SELECT * FROM local_runtimes WHERE id = @id").get({ id }) as Row | undefined,
    );
  }

  getByName(name: string): LocalRuntimeConfig | null {
    return this._rowToConfig(
      this.db.prepare("SELECT * FROM local_runtimes WHERE name = @name").get({ name }) as Row | undefined,
    );
  }

  list(): LocalRuntimeConfig[] {
    const rows = this.db.prepare("SELECT * FROM local_runtimes ORDER BY name ASC").all() as Row[];
    return rows.map((r) => this._rowToConfig(r)!);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM local_runtimes WHERE id = @id").run({ id });
  }

  private _rowToConfig(row: Row | undefined): LocalRuntimeConfig | null {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      runtimeType: row.runtime_type as LocalRuntimeConfig["runtimeType"],
      command: row.command ?? undefined,
      env: row.env_json ? (JSON.parse(row.env_json) as Record<string, string>) : undefined,
      timeoutMs: row.timeout_ms ?? undefined,
      capabilities: row.capabilities_json ? (JSON.parse(row.capabilities_json) as string[]) : undefined,
      agentId: row.agent_id ?? undefined,
      runtimeBindingId: row.runtime_binding_id ?? undefined,
      registeredAt: row.registered_at ?? new Date().toISOString(),
    };
  }
}

interface Row {
  id: string;
  name: string;
  runtime_type: string;
  command: string | null;
  env_json: string | null;
  timeout_ms: number | null;
  capabilities_json: string | null;
  agent_id: string | null;
  runtime_binding_id: string | null;
  registered_at: string;
}
