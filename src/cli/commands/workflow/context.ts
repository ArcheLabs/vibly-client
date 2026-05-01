import type { Command } from "commander";
import { requireAgentId } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerContextCommands(program: Command): void {
  const context = program.command("context").description("Manage context bundles");

  context
    .command("create")
    .description("Create a context bundle")
    .option("--goal-id <id>", "Goal/objective ID for context")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const bundle = await client.createContextBundle({
          actorId: agentId,
          goalId: opts.goalId as string | undefined,
        });
        printOutput(outputOk(bundle), Boolean(opts.json), (d) =>
          `Created context bundle: ${String((d as { id: string }).id)}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  context
    .command("accept")
    .description("Accept a context bundle (generate receipt)")
    .argument("<bundle-id>", "Context bundle ID")
    .option("--json", "Output as JSON")
    .action(async (bundleId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const receipt = await client.acceptContextBundle({ contextBundleId: bundleId, actorId: agentId });
        printOutput(outputOk(receipt), Boolean(opts.json), (d) =>
          `Context bundle accepted. Receipt: ${String((d as { id: string }).id)}`,
        );
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  context
    .command("show")
    .description("Show a context bundle")
    .argument("<bundle-id>", "Context bundle ID")
    .option("--json", "Output as JSON")
    .action(async (bundleId: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const bundle = await client.getContextBundle(bundleId);
        printOutput(outputOk(bundle), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
