import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { CoordinatorClient } from "../coordinator/client.js";
import { assertProfileNetworkState, getNetworkProfile, loadActiveProfile, requireApiToken } from "../config/profiles.js";
import { setLogger, createLogger, getLogger } from "../config/logger.js";
import { DaemonConfigSchema } from "../schemas/daemon.js";
import { subscribeSse } from "../coordinator/sse.js";
import { runLoop } from "./loop.js";
import type { DaemonConfig } from "../schemas/daemon.js";
import type { ClientProfile } from "../domain/clientTypes.js";
import { getDaemonPidPath } from "../config/paths.js";
import { clientVersionHeaderValues } from "../version.js";
import { loadUpgradeState } from "../upgrade/state.js";
import { assertNetworkFeature, refreshActiveProfileNetwork } from "../network/manifest.js";

export interface DaemonStartOptions {
  once?: boolean;
  intervalMs?: number;
  verbose?: boolean;
}

export async function startDaemon(opts: DaemonStartOptions = {}): Promise<void> {
  const log = createLogger(opts.verbose ? "debug" : "info");
  setLogger(log);

  let { config: _config, profile } = loadActiveProfile();
  const refreshed = await refreshActiveProfileNetwork().catch((error) => {
    log.warn({ err: String(error) }, "daemon: network manifest refresh failed; using cached network state");
    return undefined;
  });
  if (refreshed) profile = refreshed.profile;
  assertNetworkFeature(profile, "daemon");
  assertProfileNetworkState(profile);
  validateLinkedAgentProfile(profile);
  const network = getNetworkProfile(profile);
  const token = requireApiToken(profile);
  const client = new CoordinatorClient({ baseUrl: network.coordinatorUrl, token, networkId: network.id });
  const clientHeaders = clientVersionHeaderValues();
  log.debug(
    `coordinator client headers: package=${clientHeaders.packageName} client=${clientHeaders.clientVersion} contract=${clientHeaders.contractVersion} protocol=${clientHeaders.protocolVersion}`,
  );
  await assertActiveStakeReady(client, profile, network.id);
  claimDaemonLock();

  const daemonProfile = profile.daemon ?? {};
  const daemonConfig: DaemonConfig = DaemonConfigSchema.parse({
    ...daemonProfile,
    intervalMs: opts.intervalMs ?? 300000,
  });

  log.info({ profile: profile.name, networkId: network.id, coordinator: network.coordinatorUrl }, "daemon: starting");

  if (opts.once) {
    log.info("daemon: running single iteration");
    await sendHeartbeat(client, profile, "starting");
    await runLoop(client, profile, daemonConfig);
    await sendHeartbeat(client, profile, "available");
    releaseDaemonLock();
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
        await sendHeartbeat(client, profile, "available");
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
      void sendHeartbeat(client, profile, "offline").finally(() => {
        releaseDaemonLock();
        resolve();
      });
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  log.info("daemon: stopped");
}


function validateLinkedAgentProfile(profile: ClientProfile): void {
  const missing = [
    ["localAgentId", profile.localAgentId],
    ["principalId", profile.principalId],
    ["identityId", profile.identityId],
    ["chainAgentId", profile.chainAgentId],
    ["organizationId", profile.organizationId],
  ].filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Agent is not ready to run. Missing ${missing.join(", ")}. Open https://console.vibly.network/personal-center, finish root-wallet authorization and staking, then run \`vibly agent wait-link --local-agent-id <id>\` if this machine is not linked yet.`,
    );
  }
}

async function assertActiveStakeReady(client: CoordinatorClient, profile: ClientProfile, chainId: string): Promise<void> {
  const stakes = await client.listAgentStakes({ principalId: profile.principalId, chainId, status: "active", limit: 20 });
  const active = stakes.items.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    const chainAgentId = String(row["chainAgentId"] ?? row["agentId"] ?? "");
    const amount = Number(row["activeAmount"] ?? 0);
    return chainAgentId === profile.chainAgentId && Number.isFinite(amount) && amount > 0;
  });
  if (!active) {
    throw new Error(
      "Agent is not ready to run. No active VIB stake was found for this chain agent. Complete staking in Console with the root wallet, wait for indexer sync, then run `vibly agent status` again.",
    );
  }
}


function claimDaemonLock(): void {
  const pidPath = getDaemonPidPath();
  if (existsSync(pidPath)) {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8"), 10);
    if (Number.isFinite(pid) && isProcessAlive(pid)) {
      throw new Error(`daemon already running with pid ${pid}`);
    }
  }
  writeFileSync(pidPath, `${process.pid}\n`, { mode: 0o600 });
}

function releaseDaemonLock(): void {
  try {
    rmSync(getDaemonPidPath(), { force: true });
  } catch {
    // ignore cleanup failures during shutdown
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function sendHeartbeat(client: CoordinatorClient, profile: { agentId?: string }, availability: string): Promise<void> {
  if (!profile.agentId) return;
  const upgrade = loadUpgradeState();
  const clientHeaders = clientVersionHeaderValues();
  try {
    await client.sendAgentHeartbeat(profile.agentId, {
      clientVersion: clientHeaders.clientVersion,
      daemonVersion: clientHeaders.clientVersion,
      contractVersion: clientHeaders.contractVersion,
      protocolVersion: clientHeaders.protocolVersion,
      availability,
      upgradePhase: upgrade.phase,
    });
  } catch (e) {
    getLogger().warn({ err: String(e) }, "daemon: heartbeat failed");
  }
}
