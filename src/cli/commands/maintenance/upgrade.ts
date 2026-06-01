import type { Command } from "commander";
import { getCoordinatorClient } from "../shared/client.js";
import { handleCliError } from "../shared/errors.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { applyUpgrade, checkUpgrade } from "../../../upgrade/manager.js";
import { loadUpgradeState } from "../../../upgrade/state.js";

export function registerUpgradeCommands(program: Command): void {
  const upgrade = program.command("upgrade").description("Check and apply safe client upgrades");

  upgrade
    .command("check")
    .description("Check coordinator version policy")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client } = getCoordinatorClient();
        const result = await checkUpgrade(client);
        printOutput(outputOk(result), Boolean(opts.json), () => [
          `Current version     : ${result.currentVersion}`,
          `Minimum version     : ${result.policy.minimumClientVersion}`,
          `Recommended version : ${result.policy.recommendedClientVersion}`,
          `Target version      : ${result.targetVersion}`,
          `Upgrade required   : ${result.upgradeRequired ? "yes" : "no"}`,
          `Upgrade recommended: ${result.upgradeRecommended ? "yes" : "no"}`,
        ].join("\n"));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  upgrade
    .command("apply")
    .description("Pause duties, drain work, install the target CLI, verify, then resume duties")
    .option("--target-version <version>", "Target @vibly/client version")
    .option("--drain-timeout <ms>", "Drain timeout in milliseconds", "120000")
    .option("--confirm", "Confirm pause/install/resume upgrade flow")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { client, profile } = getCoordinatorClient();
        const result = await applyUpgrade({
          client,
          profile,
          targetVersion: opts.targetVersion as string | undefined,
          confirm: Boolean(opts.confirm),
          drainTimeoutMs: Number.parseInt(opts.drainTimeout as string, 10),
        });
        printOutput(outputOk(result), Boolean(opts.json), () => JSON.stringify(result, null, 2));
      } catch (e) {
        handleCliError(e, opts.json as boolean | undefined);
      }
    });

  upgrade
    .command("status")
    .description("Show local upgrade state")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const state = loadUpgradeState();
      printOutput(outputOk(state), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
    });
}
