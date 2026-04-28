import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ClientError, ErrorCode } from "../domain/errors.js";

export type DB = Database.Database;

export function openDatabase(dbPath: string): DB {
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return db;
  } catch (e) {
    throw new ClientError(
      ErrorCode.LOCAL_DB_ERROR,
      `Failed to open database at ${dbPath}: ${String(e)}`,
    );
  }
}
