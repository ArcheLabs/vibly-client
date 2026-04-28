import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken, requireAgentId } from "../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";

export function registerContextCommands(program: Command): void {
  const context = program.command("context").description("Manage context bundles");

  context
    .command("create")
    .description("Create a context bundle")
    .option("--goal-id <id>", "Goal/objective ID for context")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getClient();
        const agentId = requireAgentId(profile);
        const bundle = await client.createContextBundle({
          actorId: agentId,
          goalId: opts.goalId as string | undefined,
        });
        printOutput(outputOk(bundle), Boolean(opts.json), (d) =>
          `Created context bundle: ${String((d as { id: string }).id)}`,
        );
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  context
    .command("accept")
    .description("Accept a context bundle (generate receipt)")
    .argument("<bundle-id>", "Context bundle ID")
    .option("--json", "Output as JSON")
    .action(async (bundleId: string, opts) => {
      try {
        const { client, profile } = getClient();
        const agentId = requireAgentId(profile);
        const receipt = await client.acceptContextBundle({ contextBundleId: bundleId, actorId: agentId });
        printOutput(outputOk(receipt), Boolean(opts.json), (d) =>
          `Context bundle accepted. Receipt: ${String((d as { id: string }).id)}`,
        );
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  context
    .command("show")
    .description("Show a context bundle")
    .argument("<bundle-id>", "Context bundle ID")
    .option("--json", "Output as JSON")
    .action(async (bundleId: string, opts) => {
      try {
        const { client } = getClient();
        const bundle = await client.getContextBundle(bundleId);
        printOutput(outputOk(bundle), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
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
