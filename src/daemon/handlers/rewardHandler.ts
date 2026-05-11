import { randomUUID } from "node:crypto";
import type { CoordinatorClient } from "../../coordinator/client.js";
import type { ClientProfile } from "../../domain/clientTypes.js";
import type { DaemonConfig } from "../../schemas/daemon.js";
import { getLogger } from "../../config/logger.js";

export async function rewardHandler(
  client: CoordinatorClient,
  profile: ClientProfile,
  daemonConfig: DaemonConfig,
): Promise<void> {
  if (!daemonConfig.autoClaimRewards) return;
  const log = getLogger();
  const agentId = profile.agentId;
  const principalId = profile.principalId;
  if (!agentId || !principalId) return;

  try {
    const result = await client.listRewards({ actorId: agentId, status: "approved", limit: 20 });
    for (const reward of result.items) {
      log.info({ rewardId: reward.id }, "daemon: claiming reward");
      await client.submitActionIntent({
        type: "ClaimReward",
        principalId,
        payload: { rewardIntentId: reward.id, actorId: agentId },
        idempotencyKey: randomUUID(),
      });
    }
  } catch (e) {
    log.warn({ err: String(e) }, "daemon: rewardHandler error");
  }
}
