import { CoordinatorClient } from "../coordinator/client.js";
import { loadActiveProfile, requireApiToken } from "../config/profiles.js";
import { setLogger, createLogger } from "../config/logger.js";
import { DaemonConfigSchema } from "../schemas/daemon.js";
import { subscribeSse } from "../coordinator/sse.js";
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
  let running = false;
  let rerunRequested = false;
  const run = async () => {
    if (running) {
      rerunRequested = true;
      return;
    }
    running = true;
    try {
      do {
        rerunRequested = false;
        await runLoop(client, profile, daemonConfig);
      } while (rerunRequested);
    } catch (e) {
      log.error({ err: String(e) }, "daemon: loop error");
    } finally {
      running = false;
    }
  };

  // Run immediately, then on interval
  await run();

  const timer = setInterval(() => {
    void run();
  }, daemonConfig.intervalMs);
  const sseController = new AbortController();

  if (profile.sync?.enableSse !== false) {
    void subscribeSse({
      url: client.getStreamUrl(profile.projectId),
      token,
      signal: sseController.signal,
      onConnect: () => log.info("daemon: SSE connected"),
      onEvent: (event) => {
        log.debug({ type: event.type }, "daemon: SSE event received");
        void run();
      },
      onError: (err, attempt) => {
        log.warn({ err: err.message, attempt }, "daemon: SSE disconnected");
      },
    });
  }

  // Keep alive until interrupted
  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(timer);
      sseController.abort();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  log.info("daemon: stopped");
}
