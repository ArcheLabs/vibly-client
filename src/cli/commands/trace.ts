import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerTraceCommands(program: Command): void {
  const trace = program.command("trace").description("Manage execution traces");

  trace
    .command("list")
    .description("List traces")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.listTraces({ limit: parseInt(opts.limit as string, 10) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id?: string; traceId?: string; createdAt?: string }>;
          if (arr.length === 0) return "No traces";
          return arr.map((t) => `  ${t.traceId ?? t.id ?? ""}  ${t.createdAt ?? ""}`).join("\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  trace
    .command("verify")
    .description("Verify a trace")
    .argument("<id>", "Trace ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getClient();
        const result = await client.verifyTrace(id);
        printOutput(outputOk(result), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  trace
    .command("replay")
    .description("Replay a trace")
    .argument("<id>", "Trace ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getClient();
        const result = await client.replayTrace(id);
        printOutput(outputOk(result), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });
}

function getClient() {
  const { config, profile } = loadActiveProfile();
  const token = requireApiToken(profile);
  const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });
  return { client, config, profile };
}

function handleError(e: unknown, json?: boolean): void {
  if (e instanceof ClientError) {
    printOutput(outputErr(e.code, e.message, e.hint), Boolean(json));
  } else {
    printOutput(outputErr("COORDINATOR_API_ERROR", String(e)), Boolean(json));
  }
  process.exitCode = 1;
}
