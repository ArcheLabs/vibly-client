import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getLogger } from "../../config/logger.js";

export async function reviewHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  if (!daemonConfig.autoReview) return;
  const log = getLogger();
  const agentId = profile.agentId;
  if (!agentId) return;

  try {
    const result = await client.listReviews({ reviewerId: agentId, limit: 10 });
    log.debug({ count: result.items.length }, "daemon: pending reviews (auto-review not fully implemented)");
    // Full autoReview would run a review runtime and submit — stub for now
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: reviewHandler error");
  }
}
