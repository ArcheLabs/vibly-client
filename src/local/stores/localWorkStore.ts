import type { DB } from "../database.js";

export type RuntimeRunStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface RuntimeRun {
  id: string;
  workOrderId?: string;
  runtimeBindingId?: string;
  status: RuntimeRunStatus;
  startedAt: string;
  finishedAt?: string;
  input?: unknown;
  output?: unknown;
  executionReceipt?: unknown;
  logsPath?: string;
  error?: unknown;
}

export class LocalWorkStore {
  constructor(private readonly db: DB) {}

  createRun(run: Omit<RuntimeRun, "finishedAt" | "output" | "executionReceipt" | "logsPath" | "error">): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO runtime_runs
        (id, work_order_id, runtime_binding_id, status, started_at, input_json)
      VALUES
        (@id, @work_order_id, @runtime_binding_id, @status, @started_at, @input_json)
    `).run({
      id: run.id,
      work_order_id: run.workOrderId ?? null,
      runtime_binding_id: run.runtimeBindingId ?? null,
      status: run.status,
      started_at: run.startedAt,
      input_json: run.input ? JSON.stringify(run.input) : null,
    });
  }

  updateRun(id: string, patch: Partial<Pick<RuntimeRun, "status" | "finishedAt" | "output" | "executionReceipt" | "logsPath" | "error">>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (patch.status !== undefined) { fields.push("status = @status"); params["status"] = patch.status; }
    if (patch.finishedAt !== undefined) { fields.push("finished_at = @finished_at"); params["finished_at"] = patch.finishedAt; }
    if (patch.output !== undefined) { fields.push("output_json = @output_json"); params["output_json"] = JSON.stringify(patch.output); }
    if (patch.executionReceipt !== undefined) { fields.push("execution_receipt_json = @exec_receipt"); params["exec_receipt"] = JSON.stringify(patch.executionReceipt); }
    if (patch.logsPath !== undefined) { fields.push("logs_path = @logs_path"); params["logs_path"] = patch.logsPath; }
    if (patch.error !== undefined) { fields.push("error_json = @error_json"); params["error_json"] = JSON.stringify(patch.error); }

    if (fields.length === 0) return;
    this.db.prepare(`UPDATE runtime_runs SET ${fields.join(", ")} WHERE id = @id`).run(params);
  }

  getRun(id: string): RuntimeRun | null {
    const row = this.db.prepare("SELECT * FROM runtime_runs WHERE id = @id").get({ id }) as Row | undefined;
    return row ? rowToRun(row) : null;
  }

  getRunForWorkOrder(workOrderId: string): RuntimeRun | null {
    const row = this.db.prepare(
      "SELECT * FROM runtime_runs WHERE work_order_id = @wid ORDER BY started_at DESC LIMIT 1",
    ).get({ wid: workOrderId }) as Row | undefined;
    return row ? rowToRun(row) : null;
  }

  listRuns(opts?: { status?: RuntimeRunStatus; limit?: number }): RuntimeRun[] {
    let sql = "SELECT * FROM runtime_runs WHERE 1=1";
    const params: Record<string, unknown> = {};
    if (opts?.status) { sql += " AND status = @status"; params["status"] = opts.status; }
    sql += " ORDER BY started_at DESC";
    if (opts?.limit) { sql += " LIMIT @limit"; params["limit"] = opts.limit; }
    const rows = this.db.prepare(sql).all(params) as Row[];
    return rows.map(rowToRun);
  }
}

interface Row {
  id: string;
  work_order_id: string | null;
  runtime_binding_id: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  input_json: string | null;
  output_json: string | null;
  execution_receipt_json: string | null;
  logs_path: string | null;
  error_json: string | null;
}

function rowToRun(r: Row): RuntimeRun {
  return {
    id: r.id,
    workOrderId: r.work_order_id ?? undefined,
    runtimeBindingId: r.runtime_binding_id ?? undefined,
    status: r.status as RuntimeRunStatus,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
    input: r.input_json ? JSON.parse(r.input_json) as unknown : undefined,
    output: r.output_json ? JSON.parse(r.output_json) as unknown : undefined,
    executionReceipt: r.execution_receipt_json ? JSON.parse(r.execution_receipt_json) as unknown : undefined,
    logsPath: r.logs_path ?? undefined,
    error: r.error_json ? JSON.parse(r.error_json) as unknown : undefined,
  };
}
