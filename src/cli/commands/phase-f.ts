import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../config/profiles.js";
import { outputErr, outputOk, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerPhaseFCommands(program: Command): void {
  const phaseF = program.command("phase-f").description("Run and inspect the Phase F test-agent collaboration loop");

  phaseF
    .command("smoke")
    .description("Run the dev-only Phase F Observer/Delegate/Worker/Reviewer/Guardian smoke loop")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.runPhaseFSmoke();
        printOutput(outputOk(result), Boolean(opts.json), summarizeRun);
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  phaseF
    .command("runs")
    .description("List recorded Phase F smoke runs")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.listPhaseFRuns({ limit: Number(opts.limit) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const rows = items as unknown[];
          if (!rows.length) return "No Phase F runs";
          return rows.map((row) => summarizeRun(row)).join("\n\n");
        });
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });
}

function summarizeRun(value: unknown): string {
  const run = asRecord(asRecord(value)["run"] ?? value);
  const action = asRecord(run["action"]);
  const workOrder = asRecord(run["workOrder"]);
  const reviewAggregation = asRecord(run["reviewAggregation"]);
  const guardianRequest = asRecord(run["guardianRequest"]);
  const trace = asRecord(run["trace"]);
  const verification = asRecord(run["verification"]);
  const replay = asRecord(run["replay"]);
  return [
    `Phase F run: ${String(run["id"] ?? action["id"] ?? "-")}`,
    `Action: ${String(action["title"] ?? "-")} (${String(action["riskLevel"] ?? "unknown")})`,
    `Work: ${String(workOrder["status"] ?? "unknown")} | Review: ${String(reviewAggregation["result"] ?? "unknown")} | Guardian: ${String(guardianRequest["status"] ?? "unknown")}`,
    `Trace: ${String(trace["traceId"] ?? "-")} | verify=${String(verification["ok"] ?? false)} replay=${String(replay["ok"] ?? false)}`,
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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
