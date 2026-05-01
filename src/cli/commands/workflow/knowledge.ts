import type { Command } from "commander";
import { outputOk, outputErr, printOutput } from "../../../domain/apiTypes.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerKnowledgeCommands(program: Command): void {
  const knowledge = program.command("knowledge").description("Manage knowledge versions");

  knowledge
    .command("latest")
    .description("Show the latest knowledge version")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const v = await client.getLatestKnowledge();
        if (!v) {
          printOutput(outputErr("COORDINATOR_API_ERROR", "No knowledge version available"), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        printOutput(outputOk(v), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  knowledge
    .command("versions")
    .description("List knowledge versions")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await client.listKnowledgeVersions({ limit: parseInt(opts.limit as string, 10) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id: string; version?: string; createdAt?: string }>;
          if (arr.length === 0) return "No knowledge versions";
          return arr.map((v) => `  ${v.version ?? v.id}  ${v.createdAt ?? ""}`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
