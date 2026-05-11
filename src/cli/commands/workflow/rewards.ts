import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { requireAgentId, requirePrincipalId } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import type { RewardIntent } from "../../../coordinator/types.js";

import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
export function registerRewardCommands(program: Command): void {
  const rewards = program.command("rewards").description("Manage rewards");

  rewards
    .command("list")
    .description("List rewards for current agent")
    .option("--status <status>", "Filter by status")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const agentId = profile.agentId;
        const result = await client.listRewards({
          actorId: agentId,
          status: opts.status as string | undefined,
          limit: 50,
        });
        printOutput(outputOk(result.items), Boolean(opts.json), (items) => {
          const arr = items as RewardIntent[];
          if (arr.length === 0) return "No rewards found";
          return arr
            .map((r) => `  ${r.id}  ${String((r as { amount?: number }).amount ?? "")}  ${r.status ?? ""}`)
            .join("\n");
        });
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  rewards
    .command("show")
    .description("Show reward details")
    .argument("<id>", "Reward ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getCoordinatorClient();
        const r = await client.getReward(id);
        printOutput(outputOk(r), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  rewards
    .command("claim")
    .description("Claim an approved reward")
    .argument("<id>", "Reward ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const principalId = requirePrincipalId(profile);
        const agentId = requireAgentId(profile);
        const receipt = await client.submitActionIntent({
          type: "ClaimReward",
          principalId,
          payload: { rewardIntentId: id, actorId: agentId },
          idempotencyKey: randomUUID(),
        });
        printOutput(outputOk(receipt), Boolean(opts.json), () => `Reward ${ id } claimed (eventId: ${receipt.eventId})`);
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });
}
