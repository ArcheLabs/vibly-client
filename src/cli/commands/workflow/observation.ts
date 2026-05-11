import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerObservationCommands(program: Command): void {
  const observation = program.command("observation").description("Manage observation assignments");

  observation
    .command("accept")
    .description("Accept an observation assignment")
    .requiredOption("--assignment-id <id>", "Assignment ID to accept")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "AcceptObservationAssignment",
          principalId,
          projectId: profile.projectId,
          payload: { assignmentId: opts.assignmentId as string },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Observation assignment accepted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  observation
    .command("submit")
    .description("Submit an observation result")
    .requiredOption("--assignment-id <id>", "Assignment ID")
    .requiredOption("--summary <text>", "Observation summary")
    .option("--findings <text>", "Detailed findings")
    .option("--risks <text>", "Identified risks")
    .option("--suggested-actions <text>", "Suggested actions")
    .option("--artifact-uri <uri>", "Artifact URI")
    .option("--confidence <n>", "Confidence 0-1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitObservation",
          principalId,
          projectId: profile.projectId,
          payload: {
            assignmentId: opts.assignmentId as string,
            result: {
              summary: opts.summary as string,
              findings: opts.findings as string | undefined,
              risks: opts.risks as string | undefined,
              suggestedActions: opts.suggestedActions as string | undefined,
              artifactUri: opts.artifactUri as string | undefined,
              confidence: opts.confidence ? parseFloat(opts.confidence as string) : undefined,
            },
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Observation submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
