import type { Command } from "commander";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerTraceCommands(program: Command): void {
  const trace = program.command("trace").description("Manage execution traces");

  trace
    .command("list")
    .description("List traces")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listTraces({ limit: parseInt(opts.limit as string, 10) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id?: string; traceId?: string; createdAt?: string }>;
          if (arr.length === 0) return "No traces";
          return arr.map((t) => `  ${t.traceId ?? t.id ?? ""}  ${t.createdAt ?? ""}`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  trace
    .command("verify")
    .description("Verify a trace")
    .argument("<id>", "Trace ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.verifyTrace(id);
        printOutput(outputOk(result), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  trace
    .command("replay")
    .description("Replay a trace")
    .argument("<id>", "Trace ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.replayTrace(id);
        printOutput(outputOk(result), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
