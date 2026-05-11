import type { DB } from "../database.js";
import type { MechanismSnapshot } from "../../domain/clientTypes.js";

export class LocalMechanismStore {
  constructor(private readonly db: DB) {}

  upsert(mechanism: MechanismSnapshot): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_mechanisms (id, organization_id, data_json, updated_at)
      VALUES (@id, @organization_id, @data_json, @updated_at)
    `).run({
      id: mechanism.id,
      organization_id: mechanism.organizationId,
      data_json: JSON.stringify(mechanism),
      updated_at: mechanism.updatedAt,
    });
  }

  upsertMany(mechanisms: MechanismSnapshot[]): void {
    const insert = this.db.transaction((rows: MechanismSnapshot[]) => {
      for (const m of rows) this.upsert(m);
    });
    insert(mechanisms);
  }

  get(id: string): MechanismSnapshot | null {
    const row = this.db.prepare(
      "SELECT data_json FROM local_mechanisms WHERE id = @id",
    ).get({ id }) as { data_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data_json) as MechanismSnapshot;
  }

  listByOrganization(organizationId: string): MechanismSnapshot[] {
    const rows = this.db.prepare(
      "SELECT data_json FROM local_mechanisms WHERE organization_id = @organization_id ORDER BY updated_at DESC",
    ).all({ organization_id: organizationId }) as Array<{ data_json: string }>;
    return rows.map((r) => JSON.parse(r.data_json) as MechanismSnapshot);
  }

  list(): MechanismSnapshot[] {
    const rows = this.db.prepare(
      "SELECT data_json FROM local_mechanisms ORDER BY updated_at DESC",
    ).all() as Array<{ data_json: string }>;
    return rows.map((r) => JSON.parse(r.data_json) as MechanismSnapshot);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM local_mechanisms WHERE id = @id").run({ id });
  }
}
