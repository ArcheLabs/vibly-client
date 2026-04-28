import { openDatabase } from "../local/database.js";
import { runMigrations } from "../local/migrations.js";
import { LocalRuntimeStore } from "../local/stores/localRuntimeStore.js";
import { getDatabasePath } from "../config/paths.js";
import type { LocalRuntimeConfig } from "../domain/clientTypes.js";

export function getRuntimeByName(name: string): LocalRuntimeConfig | null {
  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  return new LocalRuntimeStore(db).getByName(name);
}

export function getRuntimeById(id: string): LocalRuntimeConfig | null {
  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  return new LocalRuntimeStore(db).getById(id);
}

export function listRuntimes(): LocalRuntimeConfig[] {
  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  return new LocalRuntimeStore(db).list();
}
