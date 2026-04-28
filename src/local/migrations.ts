import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./database.js";

export function runMigrations(db: DB): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schemaPath = resolve(__dirname, "schema.sql");
  const sql = readFileSync(schemaPath, "utf8");

  // Split by semicolon and run each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  db.transaction(() => {
    for (const stmt of statements) {
      db.prepare(stmt).run();
    }
  })();
}
