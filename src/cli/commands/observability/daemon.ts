import type { Command } from "commander";
import { loadConfig } from "../../../config/config.js";
import { loadActiveProfile } from "../../../config/profiles.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";

export function registerDaemonCommands(program: Command): void {
  const daemon = program.command("daemon").description("Run the automation daemon");

  daemon
    .command("start")
    .description("Start the daemon (foreground long-running process)")
    .option("--interval <ms>", "Poll interval in milliseconds", "30000")
    .option("--verbose", "Enable debug logging")
    .action(async (opts) => {
      const { startDaemon } = await import("../../../daemon/daemon.js");
      await startDaemon({
        intervalMs: parseInt(opts.interval as string, 10),
        verbose: Boolean(opts.verbose),
      });
    });

  daemon
    .command("once")
    .description("Run a single daemon iteration and exit")
    .option("--verbose", "Enable debug logging")
    .action(async (opts) => {
      const { startDaemon } = await import("../../../daemon/daemon.js");
      await startDaemon({ once: true, verbose: Boolean(opts.verbose) });
    });

  daemon
    .command("status")
    .description("Show daemon configuration for active profile")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const { profile } = loadActiveProfile();
      const daemonCfg = profile.daemon ?? {};
      printOutput(outputOk(daemonCfg), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
    });
}
