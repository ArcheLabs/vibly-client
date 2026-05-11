import type { DB } from "../database.js";
import type { OrganizationSnapshot } from "../../domain/clientTypes.js";

export class LocalOrganizationStore {
  constructor(private readonly db: DB) {}

  upsert(org: OrganizationSnapshot): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_organizations (id, data_json, updated_at)
      VALUES (@id, @data_json, @updated_at)
    `).run({
      id: org.id,
      data_json: JSON.stringify(org),
      updated_at: org.updatedAt ?? new Date().toISOString(),
    });
  }

  upsertMany(orgs: OrganizationSnapshot[]): void {
    const insert = this.db.transaction((rows: OrganizationSnapshot[]) => {
      for (const org of rows) this.upsert(org);
    });
    insert(orgs);
  }

  get(id: string): OrganizationSnapshot | null {
    const row = this.db.prepare(
      "SELECT data_json FROM local_organizations WHERE id = @id",
    ).get({ id }) as { data_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data_json) as OrganizationSnapshot;
  }

  list(): OrganizationSnapshot[] {
    const rows = this.db.prepare(
      "SELECT data_json FROM local_organizations ORDER BY updated_at DESC",
    ).all() as Array<{ data_json: string }>;
    return rows.map((r) => JSON.parse(r.data_json) as OrganizationSnapshot);
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM local_organizations WHERE id = @id").run({ id });
  }
}
