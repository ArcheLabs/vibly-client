import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerKnowledgeCommands(program: Command): void {
  const knowledge = program.command("knowledge").description("Manage knowledge versions");

  knowledge
    .command("latest")
    .description("Show the latest knowledge version")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const v = await client.getLatestKnowledge();
        if (!v) {
          printOutput(outputErr("COORDINATOR_API_ERROR", "No knowledge version available"), Boolean(opts.json));
          process.exitCode = 1;
          return;
        }
        printOutput(outputOk(v), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  knowledge
    .command("versions")
    .description("List knowledge versions")
    .option("--limit <n>", "Page size", "20")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getClient();
        const result = await client.listKnowledgeVersions({ limit: parseInt(opts.limit as string, 10) });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as Array<{ id: string; version?: string; createdAt?: string }>;
          if (arr.length === 0) return "No knowledge versions";
          return arr.map((v) => `  ${v.version ?? v.id}  ${v.createdAt ?? ""}`).join("\n");
        });
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
