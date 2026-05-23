import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { handleCliError } from "../shared/errors.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { localFileMemoryAdapter } from "../../../memory/adapters/localFile.js";
import { sqliteMemoryAdapter } from "../../../memory/adapters/sqlite.js";
import type { MemoryAdapter, MemoryKind, MemoryScope } from "../../../memory/types.js";

function getAdapter(type: string): MemoryAdapter {
  if (type === "sqlite") return sqliteMemoryAdapter;
  return localFileMemoryAdapter;
}

export function registerMemoryCommands(program: Command): void {
  const memory = program.command("memory").description("Manage local agent memory");

  // ── memory status ──────────────────────────────────────────────────────────
  memory
    .command("status")
    .description("Show health and entry counts for all memory adapters")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const [fileStatus, sqliteStatus] = await Promise.all([
          localFileMemoryAdapter.status(),
          sqliteMemoryAdapter.status(),
        ]);
        const statuses = [fileStatus, sqliteStatus];
        printOutput(outputOk(statuses), Boolean(opts.json), (d) => {
          const rows = d as typeof statuses;
          return rows.map((s) => [
            `  ${s.type.padEnd(12)}`,
            s.healthy ? "✓ healthy" : "✗ error",
            s.entryCount !== undefined ? `${String(s.entryCount)} entries` : "",
            s.storageDir ? `(${s.storageDir})` : "",
          ].filter(Boolean).join("  ")).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  // ── memory providers ───────────────────────────────────────────────────────
  memory
    .command("providers")
    .description("List available memory adapters")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const providers = [
          { id: "local-file", displayName: "Local File (JSONL)", description: "Simple per-scope JSONL storage under ~/.vibly/memory/" },
          { id: "sqlite", displayName: "SQLite (FTS5)", description: "Full-text search SQLite at ~/.vibly/memory/memory.sqlite" },
        ];
        printOutput(outputOk(providers), Boolean(opts.json), (d) => {
          const ps = d as typeof providers;
          return ps.map((p) => `  ${p.id.padEnd(14)} ${p.displayName}  — ${p.description}`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  // ── memory write ───────────────────────────────────────────────────────────
  memory
    .command("write")
    .description("Write a memory entry to the local store")
    .requiredOption("--owner-id <id>", "Owner ID (agent ID or org ID)")
    .requiredOption("--content <text>", "Memory content (plain text)")
    .option("--scope <scope>", "Memory scope: agent_private | organization", "agent_private")
    .option("--kind <kind>", "Memory kind: fact|observation|preference|procedure|relationship|episodic", "observation")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--adapter <type>", "Adapter: local-file | sqlite", "sqlite")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const adapter = getAdapter(opts.adapter as string);
        const result = await adapter.write({
          id: randomUUID(),
          scope: opts.scope as MemoryScope,
          ownerId: opts.ownerId as string,
          kind: opts.kind as MemoryKind,
          content: opts.content as string,
          tags: opts.tags ? (opts.tags as string).split(",").map((t: string) => t.trim()) : undefined,
          createdAt: new Date().toISOString(),
        });
        printOutput(outputOk(result), Boolean(opts.json), (d) => {
          const r = d as typeof result;
          return r.blocked
            ? `  ✗ Entry blocked — ${r.blockReason ?? "secret detected"}`
            : `  ✓ Entry written: ${r.entryId}`;
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  // ── memory query ───────────────────────────────────────────────────────────
  memory
    .command("query")
    .description("Search memory entries")
    .requiredOption("--owner-id <id>", "Owner ID to query")
    .option("--scope <scope>", "Memory scope: agent_private | organization", "agent_private")
    .option("--kind <kind>", "Filter by kind")
    .option("--query <text>", "Full-text search query")
    .option("--tags <tags>", "Comma-separated tag filter")
    .option("--limit <n>", "Max results", "20")
    .option("--adapter <type>", "Adapter: local-file | sqlite", "sqlite")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const adapter = getAdapter(opts.adapter as string);
        const entries = await adapter.query({
          scope: opts.scope as MemoryScope,
          ownerId: opts.ownerId as string,
          kind: opts.kind as MemoryKind | undefined,
          query: opts.query as string | undefined,
          tags: opts.tags ? (opts.tags as string).split(",").map((t: string) => t.trim()) : undefined,
          limit: parseInt(opts.limit as string, 10),
        });
        printOutput(outputOk(entries), Boolean(opts.json), (d) => {
          const items = d as typeof entries;
          if (items.length === 0) return "  No entries found.";
          return items.map((e) => `  [${e.kind}] ${e.content.slice(0, 120)}${e.content.length > 120 ? "…" : ""}  (${e.createdAt})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  // ── memory delete ──────────────────────────────────────────────────────────
  memory
    .command("delete <entryId>")
    .description("Delete a memory entry by ID")
    .option("--adapter <type>", "Adapter: local-file | sqlite", "sqlite")
    .option("--json", "Output as JSON")
    .action(async (entryId: string, opts) => {
      try {
        const adapter = getAdapter(opts.adapter as string);
        const deleted = await adapter.delete(entryId);
        printOutput(outputOk({ deleted }), Boolean(opts.json), () =>
          deleted ? `  Entry deleted: ${entryId}` : `  Entry not found: ${entryId}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
