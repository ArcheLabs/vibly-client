import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { requireAgentId, requirePrincipalId } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { NegotiationInstance } from "../../../coordinator/types.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerNegotiationCommands(program: Command): void {
  const neg = program.command("negotiation").description("Manage negotiations");

  neg
    .command("list")
    .description("List negotiations")
    .option("--status <status>", "Filter by status (open|closed)")
    .option("--project-id <id>", "Filter by project ID")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await client.listNegotiations({
          status: opts.status as string | undefined,
          projectId: (opts.projectId as string | undefined) ?? profile.projectId,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as NegotiationInstance[];
          if (arr.length === 0) return "No negotiations found";
          return arr.map((n) => `  ${n.id}  ${(n as { topic?: string }).topic ?? ""}  (${n.status ?? ""})`).join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  neg
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

  neg
    .command("position")
    .description("Submit a position on a negotiation")
    .argument("<id>", "Negotiation ID")
    .requiredOption("--stance <stance>", "Stance: support|oppose|abstain|revise|escalate")
    .requiredOption("--rationale <text>", "Rationale")
    .option("--score <n>", "Confidence score 0-1")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const agentId = requireAgentId(profile);
        const receipt = await client.submitActionIntent({
          type: "SubmitNegotiationPosition",
          principalId,
          projectId: profile.projectId,
          payload: {
            negotiationId: id,
            actorId: agentId,
            stance: opts.stance as string,
            rationale: opts.rationale as string,
            score: opts.score ? parseFloat(opts.score as string) : undefined,
          },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Position submitted on negotiation ${ id } (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
