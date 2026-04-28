import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { loadActiveProfile } from "../../config/profiles.js";
import { openDatabase } from "../../local/database.js";
import { runMigrations } from "../../local/migrations.js";
import { LocalRuntimeStore } from "../../local/stores/localRuntimeStore.js";
import { getDatabasePath } from "../../config/paths.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";
import type { LocalRuntimeConfig } from "../../domain/clientTypes.js";

function getStore(): LocalRuntimeStore {
  const db = openDatabase(getDatabasePath());
  runMigrations(db);
  return new LocalRuntimeStore(db);
}

export function registerRuntimeCommands(program: Command): void {
  const runtime = program.command("runtime").description("Manage local runtimes");

  runtime
    .command("list")
    .description("List registered local runtimes")
    .option("--json", "Output as JSON")
    .action((opts) => {
      try {
        const runtimes = getStore().list();
        printOutput(outputOk(runtimes), Boolean(opts.json), (items) => {
          const arr = items as LocalRuntimeConfig[];
          if (arr.length === 0) return "No runtimes registered. Use `vibly runtime register-script` to add one.";
          return arr
            .map((r) => `  ${r.name.padEnd(20)} ${r.runtimeType.padEnd(16)} ${r.command ?? ""}`)
            .join("\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  runtime
    .command("register-script")
    .description("Register a local script as a runtime")
    .requiredOption("--name <name>", "Runtime name (must be unique)")
    .requiredOption("--command <cmd>", "Script command to execute")
    .option("--timeout <ms>", "Execution timeout in milliseconds", "300000")
    .option("--capabilities <caps>", "Comma-separated capabilities")
    .option("--json", "Output as JSON")
    .action((opts) => {
      console.error(
        "⚠  Security notice: Script runtimes execute arbitrary commands. Only register scripts you trust.",
      );

      try {
        const store = getStore();
        const { profile } = loadActiveProfile();

        const runtime: LocalRuntimeConfig = {
          id: randomUUID(),
          name: opts.name as string,
          runtimeType: "script",
          command: opts.command as string,
          timeoutMs: parseInt(opts.timeout as string, 10),
          capabilities: opts.capabilities
            ? (opts.capabilities as string).split(",").map((s: string) => s.trim())
            : undefined,
          agentId: profile.agentId,
          runtimeBindingId: profile.defaultRuntimeBindingId,
          registeredAt: new Date().toISOString(),
        };

        store.register(runtime);
        printOutput(outputOk(runtime), Boolean(opts.json), (r) =>
          `Registered runtime '${String((r as { name: string }).name)}' (id: ${String((r as { id: string }).id)})`,
        );
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  runtime
    .command("show")
    .description("Show details of a registered runtime")
    .argument("<name-or-id>", "Runtime name or ID")
    .option("--json", "Output as JSON")
    .action((nameOrId: string, opts) => {
      try {
        const store = getStore();
        const r = store.getByName(nameOrId) ?? store.getById(nameOrId);
        if (!r) {
          printOutput(outputErr("RUNTIME_NOT_FOUND", `Runtime '${nameOrId}' not found`), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        printOutput(outputOk(r), Boolean(opts.json), (d) => {
          const rt = d as LocalRuntimeConfig;
          return [
            `ID:      ${rt.id}`,
            `Name:    ${rt.name}`,
            `Type:    ${rt.runtimeType}`,
            rt.command ? `Command: ${rt.command}` : "",
            rt.timeoutMs ? `Timeout: ${rt.timeoutMs}ms` : "",
          ]
            .filter(Boolean)
            .join("\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  runtime
    .command("delete")
    .description("Remove a registered runtime")
    .argument("<name-or-id>", "Runtime name or ID")
    .option("--json", "Output as JSON")
    .action((nameOrId: string, opts) => {
      try {
        const store = getStore();
        const r = store.getByName(nameOrId) ?? store.getById(nameOrId);
        if (!r) {
          printOutput(outputErr("RUNTIME_NOT_FOUND", `Runtime '${nameOrId}' not found`), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        store.delete(r.id);
        printOutput(outputOk({ deleted: r.id }), Boolean(opts.json), () => `Deleted runtime '${nameOrId}'`);
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });
}

function handleError(e: unknown, json?: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), Boolean(json));
  } else {
    printOutput(outputErr("LOCAL_DB_ERROR", String(e)), Boolean(json));
  }
  process.exitCode = 1;
}
