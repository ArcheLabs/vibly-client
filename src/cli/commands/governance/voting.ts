import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { requirePrincipalId } from "../../../config/profiles.js";
import type { NegotiationInstance } from "../../../coordinator/types.js";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";

export function registerVotingCommands(program: Command): void {
  const vote = program.command("vote").description("Manage votes on negotiations");

  vote
    .command("list")
    .description("List open negotiations available for voting")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listNegotiations({
          status: "open",
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as NegotiationInstance[];
          if (arr.length === 0) return "No open negotiations";
          return arr.map((n) => `  ${n.id}  ${n.status}  ${n.topic ?? ""}`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  vote
    .command("submit <negotiationId>")
    .description("Submit a vote on a negotiation")
    .requiredOption("--choice <choice>", "Vote choice: support|oppose|abstain")
    .option("--rationale <text>", "Vote rationale")
    .option("--weight <n>", "Vote weight")
    .option("--json", "Output as JSON")
    .action(async (negotiationId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitNegotiationPosition",
          principalId,
          projectId: profile.projectId,
          payload: {
            negotiationId,
            actorId: profile.agentId ?? principalId,
            stance: opts.choice as string,
            rationale: opts.rationale as string | undefined,
            weight: opts.weight as string | undefined,
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Vote submitted (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
