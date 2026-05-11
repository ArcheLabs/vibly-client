import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerTaskCommands(program: Command): void {
  const task = program.command("task").description("Manage tasks (work orders)");

  task
    .command("list")
    .description("List available tasks")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listAvailableTasks({
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as unknown[];
          if (arr.length === 0) return "No available tasks";
          return arr.map((t) => JSON.stringify(t)).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("claim <taskId>")
    .description("Claim a task")
    .option("--lease-ms <ms>", "Lease duration in milliseconds")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "ClaimWorkOrder",
          principalId,
          projectId: profile.projectId,
          payload: {
            workOrderId: taskId,
            actorId: profile.agentId ?? principalId,
            leaseMs: opts.leaseMs ? parseInt(opts.leaseMs as string, 10) : undefined,
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Task claimed (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  task
    .command("submit <taskId>")
    .description("Submit task result")
    .requiredOption("--summary <text>", "Task summary")
    .option("--artifact-uri <uri>", "Artifact URI")
    .option("--artifact-hash <hash>", "Artifact hash")
    .option("--artifact-media-type <type>", "Artifact media type")
    .option("--json", "Output as JSON")
    .action(async (taskId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitWorkOrder",
          principalId,
          projectId: profile.projectId,
          payload: {
            workOrderId: taskId,
            submittedBy: profile.agentId ?? principalId,
            summary: opts.summary as string,
            artifacts: opts.artifactUri
              ? [{ uri: opts.artifactUri as string, hash: opts.artifactHash as string | undefined, mediaType: opts.artifactMediaType as string | undefined }]
              : [],
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Task submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
