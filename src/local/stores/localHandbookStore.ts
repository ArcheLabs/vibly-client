import type { DB } from "../database.js";
import type { ProjectHandbookSnapshot } from "../../domain/clientTypes.js";

export class LocalHandbookStore {
  constructor(private readonly db: DB) {}

  upsert(handbook: ProjectHandbookSnapshot): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO local_handbooks (scope, scope_id, data_json, updated_at)
      VALUES (@scope, @scope_id, @data_json, @updated_at)
    `).run({
      scope: "project",
      scope_id: handbook.projectId,
      data_json: JSON.stringify(handbook),
      updated_at: handbook.updatedAt,
    });
  }

  getForProject(projectId: string): ProjectHandbookSnapshot | null {
    const row = this.db.prepare(
      "SELECT data_json FROM local_handbooks WHERE scope = 'project' AND scope_id = @scope_id",
    ).get({ scope_id: projectId }) as { data_json: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.data_json) as ProjectHandbookSnapshot;
  }

  delete(scope: string, scopeId: string): void {
    this.db.prepare(
      "DELETE FROM local_handbooks WHERE scope = @scope AND scope_id = @scope_id",
    ).run({ scope, scope_id: scopeId });
  }
}
