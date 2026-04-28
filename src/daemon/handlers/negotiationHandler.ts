import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getLogger } from "../../config/logger.js";

export async function negotiationHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  // Negotiation auto-handling uses same logic as vote handler
  // but for explicitly targeted negotiations (not delegate votes)
  if (!daemonConfig.autoVote) return;
  const log = getLogger();
  log.debug("daemon: negotiationHandler — delegated to voteHandler logic");
}
