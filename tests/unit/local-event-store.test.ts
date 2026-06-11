import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/local/database.js";
import { runMigrations } from "../../src/local/migrations.js";
import { LocalEventStore } from "../../src/local/stores/localEventStore.js";
import type { EventEnvelope } from "../../src/coordinator/types.js";

const dirs: string[] = [];

describe("LocalEventStore", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("stores coordinator events whose timestamp is an iso object", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibly-client-events-"));
    dirs.push(dir);
    const db = openDatabase(join(dir, "client.sqlite"));
    runMigrations(db);

    const store = new LocalEventStore(db);
    store.upsert({
      id: "eventid_1",
      type: "ObservationTaskCreated",
      timestamp: { iso: "2026-06-11T05:33:37.627Z" },
      payload: { taskId: "task_1" },
    } as unknown as EventEnvelope);

    expect(store.list()).toMatchObject([
      {
        id: "eventid_1",
        type: "ObservationTaskCreated",
        timestamp: "2026-06-11T05:33:37.627Z",
      },
    ]);
    db.close();
  });
});
