import type { Command } from "commander";
import { CoordinatorClient } from "../../coordinator/client.js";
import { loadActiveProfile, requireApiToken, requireAgentId } from "../../config/profiles.js";
import { outputOk, outputErr, printOutput } from "../../domain/apiTypes.js";
import { ClientError } from "../../domain/errors.js";
import type { RewardIntent } from "../../coordinator/types.js";

export function registerRewardCommands(program: Command): void {
  const rewards = program.command("rewards").description("Manage rewards");

  rewards
    .command("list")
    .description("List rewards for current agent")
    .option("--status <status>", "Filter by status")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getClient();
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
        handleError(e, opts.json as boolean | undefined);
      }
    });

  rewards
    .command("show")
    .description("Show reward details")
    .argument("<id>", "Reward ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client } = getClient();
        const r = await client.getReward(id);
        printOutput(outputOk(r), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
      } catch (e) {
        handleError(e, opts.json as boolean | undefined);
      }
    });

  rewards
    .command("claim")
    .description("Claim an approved reward")
    .argument("<id>", "Reward ID")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      try {
        const { client, profile } = getClient();
        const agentId = requireAgentId(profile);
        await client.claimReward(id, { actorId: agentId });
        printOutput(outputOk({ id }), Boolean(opts.json), () => `Reward ${id} claimed`);
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
