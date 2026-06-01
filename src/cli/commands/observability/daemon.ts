import type { Command } from "commander";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { loadActiveProfile } from "../../../config/profiles.js";
import { getClientLogPath, getDaemonPidPath } from "../../../config/paths.js";
import { outputOk, printOutput } from "../../../domain/apiTypes.js";
import { loadUpgradeState } from "../../../upgrade/state.js";

export function registerDaemonCommands(program: Command): void {
  const daemon = program.command("daemon").description("Run the automation daemon");

  daemon
    .command("start")
    .description("Start the daemon (foreground long-running process)")
    .option("--interval <ms>", "Poll interval in milliseconds", "300000")
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
    .command("stop")
    .description("Stop a foreground/background daemon by pid file")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const pidPath = getDaemonPidPath();
      const pid = readPid(pidPath);
      if (!pid) {
        printOutput(outputOk({ running: false, pidPath }), Boolean(opts.json), () => "Daemon is not running");
        return;
      }
      process.kill(pid, "SIGTERM");
      rmSync(pidPath, { force: true });
      printOutput(outputOk({ stopped: true, pid, pidPath }), Boolean(opts.json), () => `Stopped daemon pid ${pid}`);
    });

  daemon
    .command("status")
    .description("Show daemon status for active profile")
    .option("--json", "Output as JSON")
    .action((opts) => {
      const { profile } = loadActiveProfile();
      const pidPath = getDaemonPidPath();
      const pid = readPid(pidPath);
      const data = {
        running: pid ? isProcessAlive(pid) : false,
        pid,
        pidPath,
        logPath: getClientLogPath(),
        profile: profile.name,
        daemon: profile.daemon ?? {},
        upgrade: loadUpgradeState(),
      };
      printOutput(outputOk(data), Boolean(opts.json), (d) => JSON.stringify(d, null, 2));
    });
}

function readPid(path: string): number | undefined {
  if (!existsSync(path)) return undefined;
  const pid = Number.parseInt(readFileSync(path, "utf8"), 10);
  return Number.isFinite(pid) ? pid : undefined;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
