import type { Command } from "commander";
import { requireAgentId } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { NegotiationInstance } from "../../../coordinator/types.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerVoteCommands(program: Command): void {
  const vote = program.command("vote").description("Manage votes in negotiations");

  vote
    .command("list")
    .description("List open negotiations awaiting vote")
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
          return arr.map((n) => `  ${n.id}  ${(n as { topic?: string }).topic ?? ""}  (${n.status ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  vote
    .command("show")
    .description("Show negotiation details")
    .argument("<id>", "Negotiation ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const n = await client.getNegotiation(id);
        printOutput(outputOk(n), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  vote
    .command("submit")
    .description("Submit a vote position on a negotiation")
    .argument("<negotiation-id>", "Negotiation ID")
    .requiredOption("--stance <stance>", "Stance: support|oppose|abstain|revise|escalate")
    .requiredOption("--rationale <text>", "Rationale for vote")
    .option("--score <n>", "Confidence score 0-1")
    .option("--json", "Output as JSON")
    .action(async (negotiationId: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = requireAgentId(profile);
        const n = await client.submitNegotiationPosition(negotiationId, {
          actorId: agentId,
          stance: opts.stance as string,
          rationale: opts.rationale as string,
          score: opts.score ? parseFloat(opts.score as string) : undefined,
        });
        printOutput(outputOk(n), Boolean(opts.json), () => `Vote submitted on negotiation ${ negotiationId }`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
