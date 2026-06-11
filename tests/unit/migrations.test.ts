import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/local/database.js";
import { runMigrations } from "../../src/local/migrations.js";

const dirs: string[] = [];

describe("local database migrations", () => {
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("creates tables even when schema statements are preceded by comments", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibly-client-migrations-"));
    dirs.push(dir);
    const db = openDatabase(join(dir, "client.sqlite"));

    runMigrations(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining([
      "local_events",
      "local_entities",
      "sync_state",
      "runtime_runs",
      "local_runtimes",
      "local_queue_items",
    ]));
    db.close();
  });
});
