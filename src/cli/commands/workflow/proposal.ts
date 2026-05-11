import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerProposalCommands(program: Command): void {
  const proposal = program.command("proposal").description("Manage proposals");

  proposal
    .command("submit")
    .description("Submit a proposal")
    .requiredOption("--title <text>", "Proposal title")
    .requiredOption("--body <text>", "Proposal body")
    .option("--rationale <text>", "Proposal rationale")
    .option("--project-id <id>", "Project ID")
    .option("--objective-id <id>", "Target objective ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitProposal",
          principalId,
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          payload: {
            title: opts.title as string,
            body: opts.body as string,
            rationale: opts.rationale as string | undefined,
            targetObjectiveId: opts.objectiveId as string | undefined,
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Proposal submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
