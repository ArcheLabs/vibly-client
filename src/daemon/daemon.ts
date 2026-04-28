import { CoordinatorClient } from "../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../config/profiles.js";
import { setLogger, createLogger } from "../config/logger.js";
import { DaemonConfigSchema } from "../schemas/daemon.js";
import { runLoop } from "./loop.js";
import type { DaemonConfig } from "../schemas/daemon.js";

export interface DaemonStartOptions {
  once?: boolean;
  intervalMs?: number;
  verbose?: boolean;
}

export async function startDaemon(opts: DaemonStartOptions = {}): Promise<void> {
  const log = createLogger(opts.verbose ? "debug" : "info");
  setLogger(log);

  const { config: _config, profile } = loadActiveProfile();
  const token = requireApiToken(profile);
  const client = new CoordinatorClient({ baseUrl: profile.coordinatorUrl, token });

  const daemonProfile = profile.daemon ?? {};
  const daemonConfig: DaemonConfig = DaemonConfigSchema.parse({
    ...daemonProfile,
    intervalMs: opts.intervalMs ?? 30000,
  });

  log.info({ profile: profile.name, coordinator: profile.coordinatorUrl }, "daemon: starting");

  if (opts.once) {
    log.info("daemon: running single iteration");
    await runLoop(client, profile, daemonConfig);
    log.info("daemon: done");
    return;
  }

  // Foreground long-running loop
  const run = async () => {
    try {
      await runLoop(client, profile, daemonConfig);
    } catch (e) {
      log.error({ err: String(e) }, "daemon: loop error");
    }
  };

  // Run immediately, then on interval
  await run();

  const timer = setInterval(() => {
    void run();
  }, daemonConfig.intervalMs);

  // Keep alive until interrupted
  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => { clearInterval(timer); resolve(); });
    process.once("SIGTERM", () => { clearInterval(timer); resolve(); });
  });

  log.info("daemon: stopped");
}
