import type { CoordinatorClient } from "../coordinator/client.js";
import type { ClientProfile } from "../domain/clientTypes.js";
import type { DaemonConfig } from "../schemas/daemon.js";
import { syncHandler } from "./handlers/syncHandler.js";
import { voteHandler } from "./handlers/voteHandler.js";
import { reviewHandler } from "./handlers/reviewHandler.js";
import { rewardHandler } from "./handlers/rewardHandler.js";
import { deterministicE2eHandler } from "./handlers/deterministicE2eHandler.js";
import { getLogger } from "../config/logger.js";

export async function runLoop(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  const log = getLogger();
  log.debug("daemon: running loop iteration");

  if (!daemonConfig.deterministicE2E) {
    try {
      await syncHandler(client, profile);
    } catch (e) {
      log.warn({ err: String(e) }, "daemon: sync handler failed");
    }
  }
  await deterministicE2eHandler(client, profile, daemonConfig);
  await voteHandler(client, profile, daemonConfig);
  await reviewHandler(client, profile, daemonConfig);
  await rewardHandler(client, profile, daemonConfig);
}
